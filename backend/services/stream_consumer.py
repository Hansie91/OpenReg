"""
Kafka/AMQ Streams Consumer Service

Provides functionality for:
- Consuming messages from Kafka topics
- SASL/SCRAM and mTLS authentication
- Schema deserialization (JSON, Protobuf, Avro)
- Buffering transactions for batch processing
"""

import json
import logging
import tempfile
import os
from typing import Optional, Dict, Any, List
from datetime import datetime

from services.encryption import decrypt_value
import models

logger = logging.getLogger(__name__)


# === Connection Testing ===

def test_kafka_connection(topic: models.StreamingTopic) -> Dict[str, Any]:
    """
    Test connection to a Kafka/AMQ Streams cluster.
    
    Returns connection status, broker metadata, and topic partitions.
    """
    try:
        from confluent_kafka import Consumer, KafkaException
        from confluent_kafka.admin import AdminClient
    except ImportError:
        return {
            "success": False,
            "message": "confluent-kafka package not installed. Run: pip install confluent-kafka",
            "broker_metadata": None,
            "partitions": None
        }
    
    config = build_consumer_config(topic, test_mode=True)
    
    try:
        # Use AdminClient for metadata fetch
        admin_config = {
            'bootstrap.servers': config['bootstrap.servers'],
            'security.protocol': config.get('security.protocol', 'PLAINTEXT'),
        }
        
        # Copy auth settings
        for key in ['sasl.mechanism', 'sasl.username', 'sasl.password',
                    'ssl.ca.location', 'ssl.certificate.location', 
                    'ssl.key.location', 'ssl.key.password']:
            if key in config:
                admin_config[key] = config[key]
        
        admin = AdminClient(admin_config)
        
        # Fetch cluster metadata with timeout
        metadata = admin.list_topics(topic=topic.topic_name, timeout=10)
        
        if topic.topic_name not in metadata.topics:
            return {
                "success": False,
                "message": f"Topic '{topic.topic_name}' not found in cluster",
                "broker_metadata": {"brokers": len(metadata.brokers)},
                "partitions": None
            }
        
        topic_metadata = metadata.topics[topic.topic_name]
        partitions = list(topic_metadata.partitions.keys())
        
        return {
            "success": True,
            "message": f"Successfully connected to {len(metadata.brokers)} broker(s)",
            "broker_metadata": {
                "brokers": len(metadata.brokers),
                "cluster_id": metadata.cluster_id
            },
            "partitions": partitions
        }
        
    except KafkaException as e:
        return {
            "success": False,
            "message": f"Kafka error: {str(e)}",
            "broker_metadata": None,
            "partitions": None
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Connection failed: {str(e)}",
            "broker_metadata": None,
            "partitions": None
        }
    finally:
        # Cleanup temp files if any were created
        cleanup_temp_ssl_files(config)


def build_consumer_config(topic: models.StreamingTopic, test_mode: bool = False) -> Dict[str, Any]:
    """
    Build confluent-kafka consumer configuration from topic settings.
    
    Supports:
    - SASL/SCRAM authentication
    - SASL/PLAIN authentication
    - mTLS (mutual TLS) authentication
    - No authentication (development only)
    """
    config = {
        'bootstrap.servers': topic.bootstrap_servers,
        'group.id': topic.consumer_group,
        'auto.offset.reset': topic.auto_offset_reset,
        'max.poll.interval.ms': 300000,
        'session.timeout.ms': topic.session_timeout_ms,
        'enable.auto.commit': False,  # Manual commit for reliability
    }
    
    if not test_mode:
        config['max.poll.records'] = topic.max_poll_records
    
    auth_type = topic.auth_type
    
    if auth_type == models.StreamingAuthType.SASL_SCRAM:
        config['security.protocol'] = 'SASL_SSL'
        config['sasl.mechanism'] = topic.sasl_mechanism or 'SCRAM-SHA-512'
        
        if topic.sasl_username:
            config['sasl.username'] = decrypt_value(topic.sasl_username)
        if topic.sasl_password:
            config['sasl.password'] = decrypt_value(topic.sasl_password)
        
        # Add CA cert if provided
        if topic.ssl_ca_cert:
            ca_path = write_temp_cert(decrypt_value(topic.ssl_ca_cert), 'ca')
            config['ssl.ca.location'] = ca_path
    
    elif auth_type == models.StreamingAuthType.SASL_PLAIN:
        config['security.protocol'] = 'SASL_PLAINTEXT'
        config['sasl.mechanism'] = 'PLAIN'
        
        if topic.sasl_username:
            config['sasl.username'] = decrypt_value(topic.sasl_username)
        if topic.sasl_password:
            config['sasl.password'] = decrypt_value(topic.sasl_password)
    
    elif auth_type == models.StreamingAuthType.MTLS:
        config['security.protocol'] = 'SSL'
        
        # Write certificates to temp files
        if topic.ssl_ca_cert:
            ca_path = write_temp_cert(decrypt_value(topic.ssl_ca_cert), 'ca')
            config['ssl.ca.location'] = ca_path
        
        if topic.ssl_client_cert:
            cert_path = write_temp_cert(decrypt_value(topic.ssl_client_cert), 'cert')
            config['ssl.certificate.location'] = cert_path
        
        if topic.ssl_client_key:
            key_path = write_temp_cert(decrypt_value(topic.ssl_client_key), 'key')
            config['ssl.key.location'] = key_path
        
        if topic.ssl_key_password:
            config['ssl.key.password'] = decrypt_value(topic.ssl_key_password)
    
    elif auth_type == models.StreamingAuthType.NONE:
        config['security.protocol'] = 'PLAINTEXT'
    
    return config


def write_temp_cert(content: str, prefix: str) -> str:
    """Write certificate/key content to a temporary file"""
    fd, path = tempfile.mkstemp(prefix=f"kafka_{prefix}_", suffix=".pem")
    with os.fdopen(fd, 'w') as f:
        f.write(content)
    return path


def cleanup_temp_ssl_files(config: Dict[str, Any]):
    """Remove temporary SSL files after use"""
    for key in ['ssl.ca.location', 'ssl.certificate.location', 'ssl.key.location']:
        if key in config and config[key]:
            try:
                os.unlink(config[key])
            except OSError:
                pass


# === Message Deserialization ===

def deserialize_message(
    message_value: bytes,
    schema_format: models.StreamingSchemaFormat,
    schema_definition: Optional[Dict] = None
) -> Dict[str, Any]:
    """
    Deserialize Kafka message based on schema format.
    
    Supports:
    - JSON: Plain JSON parsing
    - Protobuf: Using google.protobuf with schema definition
    - Avro: Using fastavro with schema definition
    - RAW: Return as string
    """
    if schema_format == models.StreamingSchemaFormat.JSON:
        return json.loads(message_value.decode('utf-8'))
    
    elif schema_format == models.StreamingSchemaFormat.PROTOBUF:
        return deserialize_protobuf(message_value, schema_definition)
    
    elif schema_format == models.StreamingSchemaFormat.AVRO:
        return deserialize_avro(message_value, schema_definition)
    
    elif schema_format == models.StreamingSchemaFormat.RAW:
        return {"raw": message_value.decode('utf-8', errors='replace')}
    
    else:
        # Default to JSON
        return json.loads(message_value.decode('utf-8'))


def deserialize_protobuf(data: bytes, schema_definition: Optional[Dict]) -> Dict[str, Any]:
    """
    Deserialize Protobuf message.
    
    The schema_definition should contain:
    - 'descriptor_b64': Base64-encoded FileDescriptorSet
    - 'message_type': Fully qualified message type name
    """
    try:
        from google.protobuf.descriptor_pb2 import FileDescriptorSet
        from google.protobuf.message_factory import MessageFactory
        from google.protobuf.descriptor_pool import DescriptorPool
        from google.protobuf.json_format import MessageToDict
        import base64
        
        if not schema_definition:
            raise ValueError("Protobuf schema definition required")
        
        descriptor_b64 = schema_definition.get('descriptor_b64')
        message_type = schema_definition.get('message_type')
        
        if not descriptor_b64 or not message_type:
            raise ValueError("descriptor_b64 and message_type required for Protobuf")
        
        # Parse the FileDescriptorSet
        fds = FileDescriptorSet()
        fds.ParseFromString(base64.b64decode(descriptor_b64))
        
        # Build descriptor pool
        pool = DescriptorPool()
        for fd in fds.file:
            pool.Add(fd)
        
        # Get the message descriptor
        desc = pool.FindMessageTypeByName(message_type)
        factory = MessageFactory(pool)
        msg_class = factory.GetPrototype(desc)
        
        # Parse the message
        msg = msg_class()
        msg.ParseFromString(data)
        
        return MessageToDict(msg, preserving_proto_field_name=True)
        
    except ImportError:
        raise ImportError("protobuf package required for Protobuf deserialization")
    except Exception as e:
        logger.error(f"Protobuf deserialization failed: {e}")
        raise


def deserialize_avro(data: bytes, schema_definition: Optional[Dict]) -> Dict[str, Any]:
    """
    Deserialize Avro message.
    
    The schema_definition should contain the Avro schema as a dict.
    """
    try:
        import fastavro
        from io import BytesIO
        
        if not schema_definition:
            raise ValueError("Avro schema definition required")
        
        schema = fastavro.parse_schema(schema_definition)
        reader = BytesIO(data)
        
        # Avro messages may have a 5-byte header (Confluent wire format)
        # Check for magic byte
        magic = reader.read(1)
        if magic == b'\x00':
            # Skip schema ID (4 bytes)
            reader.read(4)
        else:
            # Not wire format, reset
            reader.seek(0)
        
        records = list(fastavro.reader(reader, schema))
        return records[0] if records else {}
        
    except ImportError:
        raise ImportError("fastavro package required for Avro deserialization")
    except Exception as e:
        logger.error(f"Avro deserialization failed: {e}")
        raise


# === Consumer Class ===

class StreamingConsumer:
    """
    Kafka consumer that buffers messages to the database.
    
    Usage:
        consumer = StreamingConsumer(topic, db_session)
        consumer.start()  # Blocking, runs until stopped
        consumer.stop()
    """
    
    def __init__(self, topic: models.StreamingTopic, db_session):
        self.topic = topic
        self.db = db_session
        self.running = False
        self.consumer = None
    
    def start(self):
        """Start consuming messages (blocking)"""
        from confluent_kafka import Consumer, KafkaError
        
        config = build_consumer_config(self.topic)
        self.consumer = Consumer(config)
        self.consumer.subscribe([self.topic.topic_name])
        
        self.running = True
        logger.info(f"Started consumer for topic: {self.topic.topic_name}")
        
        try:
            while self.running:
                msg = self.consumer.poll(1.0)
                
                if msg is None:
                    continue
                
                if msg.error():
                    if msg.error().code() == KafkaError._PARTITION_EOF:
                        continue
                    else:
                        logger.error(f"Consumer error: {msg.error()}")
                        continue
                
                self._process_message(msg)
                
        finally:
            self.consumer.close()
            cleanup_temp_ssl_files(config)
    
    def stop(self):
        """Signal the consumer to stop"""
        self.running = False
    
    def _process_message(self, msg):
        """Process a single Kafka message"""
        try:
            # Deserialize
            payload = deserialize_message(
                msg.value(),
                self.topic.schema_format,
                self.topic.schema_definition
            )
            
            # Parse headers
            headers = {}
            if msg.headers():
                headers = {k: v.decode('utf-8') if v else None for k, v in msg.headers()}
            
            # Buffer in database
            buffer_entry = models.StreamingBuffer(
                tenant_id=self.topic.tenant_id,
                topic_id=self.topic.id,
                partition=msg.partition(),
                offset=msg.offset(),
                message_key=msg.key().decode('utf-8') if msg.key() else None,
                payload=payload,
                headers=headers,
                received_at=datetime.utcnow()
            )
            
            self.db.add(buffer_entry)
            self.db.commit()
            
            # Commit offset
            self.consumer.commit(msg)
            
            logger.debug(f"Buffered message: partition={msg.partition()}, offset={msg.offset()}")
            
        except Exception as e:
            logger.error(f"Failed to process message: {e}")
            self.db.rollback()
