"""
Create MiFIR Transactions Table

This script creates a mifir_transactions table in the database
with columns aligned to MiFIR RTS25 transaction reporting requirements.
"""

import psycopg2
from datetime import datetime, date, timedelta
import random
import uuid

# Database connection (use 'postgres' for Docker container)
conn = psycopg2.connect(
    host="postgres",
    port=5432,
    database="openreg",
    user="openreg",
    password="openreg_dev_password"
)
cursor = conn.cursor()

# Create table for MiFIR transactions
create_table_sql = """
DROP TABLE IF EXISTS mifir_transactions CASCADE;

CREATE TABLE mifir_transactions (
    -- Record identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_reference VARCHAR(52) NOT NULL,
    
    -- Submitting entity
    submitting_entity_lei VARCHAR(20) NOT NULL,
    executing_entity_lei VARCHAR(20) NOT NULL,
    
    -- Investment decision
    investment_decision_within_firm VARCHAR(50),
    investment_decision_person_code VARCHAR(50),
    
    -- Execution
    execution_within_firm VARCHAR(50),
    execution_person_code VARCHAR(50),
    
    -- Buyer details
    buyer_lei VARCHAR(20),
    buyer_first_name VARCHAR(140),
    buyer_surname VARCHAR(140),
    buyer_date_of_birth DATE,
    buyer_country VARCHAR(2),
    buyer_decision_maker_code VARCHAR(50),
    
    -- Seller details
    seller_lei VARCHAR(20),
    seller_first_name VARCHAR(140),
    seller_surname VARCHAR(140),
    seller_date_of_birth DATE,
    seller_country VARCHAR(2),
    seller_decision_maker_code VARCHAR(50),
    
    -- Transmission details
    transmission_indicator BOOLEAN DEFAULT FALSE,
    transmitting_firm_lei VARCHAR(20),
    
    -- Trading date and time
    trading_date_time TIMESTAMP NOT NULL,
    trading_capacity VARCHAR(4) NOT NULL, -- DEAL, MTCH, AOTC, PRIN
    
    -- Quantity and price
    quantity DECIMAL(25, 5) NOT NULL,
    quantity_currency VARCHAR(3),
    price DECIMAL(25, 10) NOT NULL,
    price_currency VARCHAR(3) NOT NULL,
    net_amount DECIMAL(25, 2),
    
    -- Instrument identification
    instrument_isin VARCHAR(12) NOT NULL,
    instrument_full_name VARCHAR(350),
    instrument_classification VARCHAR(6), -- CFI code
    
    -- Venue and trading details
    venue_mic VARCHAR(4) NOT NULL,
    country_of_branch VARCHAR(2),
    up_front_payment DECIMAL(25, 2),
    up_front_payment_currency VARCHAR(3),
    
    -- Complex trade details
    complex_trade_id VARCHAR(35),
    
    -- Short selling
    short_selling_indicator VARCHAR(4), -- SESH, SSEX, SELL, UNDI
    
    -- Waiver indicators
    otc_post_trade_indicator VARCHAR(4),
    commodity_derivative_indicator BOOLEAN DEFAULT FALSE,
    securities_financing_indicator BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    business_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending'
);

-- Create indexes
CREATE INDEX idx_mifir_business_date ON mifir_transactions(business_date);
CREATE INDEX idx_mifir_trading_date ON mifir_transactions(trading_date_time);
CREATE INDEX idx_mifir_instrument ON mifir_transactions(instrument_isin);
CREATE INDEX idx_mifir_status ON mifir_transactions(status);
CREATE INDEX idx_mifir_submitting_lei ON mifir_transactions(submitting_entity_lei);
"""

print("Creating mifir_transactions table...")
cursor.execute(create_table_sql)
conn.commit()
print("Table created successfully!")

# Sample data
leis = [
    "529900HNOAA1KXQJUQ27",  # Example LEI 1
    "5493001KJTIIGC8Y1R12",  # Example LEI 2
    "213800WSGIIZCXF0FC23",  # Example LEI 3
    "549300MLUDYVRQOOXS22",  # Example LEI 4
]

isins = [
    ("US0378331005", "APPLE INC"),
    ("US5949181045", "MICROSOFT CORPORATION"),
    ("DE0007164600", "SAP SE"),
    ("GB00B1YW4409", "ASTRAZENECA PLC"),
    ("FR0000121014", "LVMH MOET HENNESSY LOUIS VUITTON SE"),
    ("NL0010273215", "ASML HOLDING N.V."),
    ("CH0038863350", "NESTLE S.A."),
    ("DE0007236101", "SIEMENS AKTIENGESELLSCHAFT"),
]

venues = ["XLON", "XPAR", "XETR", "XAMS", "XMIL", "XSWX", "XBRU"]
capacities = ["DEAL", "MTCH", "AOTC", "PRIN"]
currencies = ["EUR", "USD", "GBP", "CHF"]
countries = ["GB", "DE", "FR", "NL", "CH", "IT", "BE"]
short_indicators = ["SESH", "SSEX", "SELL", "UNDI", None]

# Generate sample transactions
print("Inserting sample transactions...")
business_date = date.today()

for i in range(50):
    isin, name = random.choice(isins)
    trading_time = datetime.now() - timedelta(
        hours=random.randint(1, 72),
        minutes=random.randint(0, 59),
        seconds=random.randint(0, 59)
    )
    
    price = round(random.uniform(10, 500), 4)
    quantity = round(random.uniform(100, 10000), 2)
    currency = random.choice(currencies)
    
    # Generate buyer/seller
    is_institutional = random.choice([True, False])
    
    cursor.execute("""
        INSERT INTO mifir_transactions (
            transaction_reference,
            submitting_entity_lei,
            executing_entity_lei,
            investment_decision_within_firm,
            execution_within_firm,
            buyer_lei,
            buyer_first_name,
            buyer_surname,
            buyer_country,
            seller_lei,
            seller_first_name,
            seller_surname,
            seller_country,
            trading_date_time,
            trading_capacity,
            quantity,
            quantity_currency,
            price,
            price_currency,
            net_amount,
            instrument_isin,
            instrument_full_name,
            venue_mic,
            country_of_branch,
            short_selling_indicator,
            business_date,
            status
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
    """, (
        f"TXN{datetime.now().strftime('%Y%m%d')}{i:06d}",  # transaction_reference
        random.choice(leis),  # submitting_entity_lei
        random.choice(leis),  # executing_entity_lei
        f"ALGO{random.randint(1, 5):03d}",  # investment_decision_within_firm
        f"EXEC{random.randint(1, 10):03d}",  # execution_within_firm
        random.choice(leis) if is_institutional else None,  # buyer_lei
        None if is_institutional else random.choice(["John", "Marie", "Hans", "Pierre", "Anna"]),  # buyer_first_name
        None if is_institutional else random.choice(["Smith", "Mueller", "Dupont", "Williams", "Brown"]),  # buyer_surname
        random.choice(countries),  # buyer_country
        random.choice(leis) if is_institutional else None,  # seller_lei
        None if is_institutional else random.choice(["James", "Sophie", "Klaus", "Jean", "Emma"]),  # seller_first_name
        None if is_institutional else random.choice(["Johnson", "Schmidt", "Martin", "Taylor", "Lee"]),  # seller_surname
        random.choice(countries),  # seller_country
        trading_time,  # trading_date_time
        random.choice(capacities),  # trading_capacity
        quantity,  # quantity
        currency,  # quantity_currency
        price,  # price
        currency,  # price_currency
        round(price * quantity, 2),  # net_amount
        isin,  # instrument_isin
        name,  # instrument_full_name
        random.choice(venues),  # venue_mic
        random.choice(countries),  # country_of_branch
        random.choice(short_indicators),  # short_selling_indicator
        business_date,  # business_date
        random.choice(["pending", "validated", "submitted"])  # status
    ))

conn.commit()

# Verify
cursor.execute("SELECT COUNT(*) FROM mifir_transactions")
count = cursor.fetchone()[0]
print(f"\nInserted {count} sample transactions")

cursor.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'mifir_transactions' ORDER BY ordinal_position")
columns = cursor.fetchall()
print(f"\nTable has {len(columns)} columns:")
for col_name, col_type in columns[:15]:
    print(f"  - {col_name}: {col_type}")
print("  ... and more")

cursor.close()
conn.close()
print("\nDone! The mifir_transactions table is ready for report mapping.")
