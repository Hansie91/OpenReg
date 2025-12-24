"""
Generate 50,000 sample MiFIR transactions
"""
import psycopg2
from datetime import datetime, date, timedelta
import random

conn = psycopg2.connect(
    host="postgres",
    port=5432,
    database="openreg",
    user="openreg",
    password="openreg_dev_password"
)
cursor = conn.cursor()

# Sample data
leis = [
    "529900HNOAA1KXQJUQ27",
    "5493001KJTIIGC8Y1R12",
    "213800WSGIIZCXF0FC23",
    "549300MLUDYVRQOOXS22",
    "549300UDSF9F5RJQHN88",
    "213800XQCGB2S8JT0R99",
]

isins = [
    ("US0378331005", "APPLE INC"),
    ("US5949181045", "MICROSOFT CORPORATION"),
    ("DE0007164600", "SAP SE"),
    ("GB00B1YW4409", "ASTRAZENECA PLC"),
    ("FR0000121014", "LVMH"),
    ("NL0010273215", "ASML HOLDING"),
    ("CH0038863350", "NESTLE"),
    ("DE0007236101", "SIEMENS"),
    ("US88160R1014", "TESLA INC"),
    ("US02079K1079", "ALPHABET INC"),
]

venues = ["XLON", "XPAR", "XETR", "XAMS", "XMIL", "XSWX", "XBRU", "XNYS", "XNAS"]
capacities = ["DEAL", "MTCH", "AOTC", "PRIN"]
currencies = ["EUR", "USD", "GBP", "CHF"]
countries = ["GB", "DE", "FR", "NL", "CH", "IT", "BE", "US"]
short_indicators = ["SESH", "SSEX", "SELL", "UNDI", None]
names = [("John", "Smith"), ("Marie", "Mueller"), ("Hans", "Schmidt"), ("Pierre", "Dupont"), ("Anna", "Brown")]

print("Clearing existing transactions...")
cursor.execute("DELETE FROM mifir_transactions")

print("Inserting 50000 transactions in batches...")
batch_size = 1000
business_date = date.today()

for batch in range(50):
    values = []
    for i in range(batch_size):
        isin, inst_name = random.choice(isins)
        trading_time = datetime.now() - timedelta(hours=random.randint(0, 168), minutes=random.randint(0, 59))
        price = round(random.uniform(10, 500), 4)
        quantity = round(random.uniform(100, 10000), 2)
        currency = random.choice(currencies)
        is_institutional = random.choice([True, False])
        
        buyer_lei = random.choice(leis) if is_institutional else None
        buyer_fn, buyer_sn = random.choice(names) if not is_institutional else (None, None)
        seller_lei = random.choice(leis) if is_institutional else None
        seller_fn, seller_sn = random.choice(names) if not is_institutional else (None, None)
        
        tx_ref = "TXN" + business_date.strftime("%Y%m%d") + str(batch * batch_size + i).zfill(6)
        
        values.append((
            tx_ref,
            random.choice(leis),
            random.choice(leis),
            "ALGO" + str(random.randint(1, 5)).zfill(3),
            "EXEC" + str(random.randint(1, 10)).zfill(3),
            buyer_lei,
            buyer_fn,
            buyer_sn,
            random.choice(countries),
            seller_lei,
            seller_fn,
            seller_sn,
            random.choice(countries),
            trading_time,
            random.choice(capacities),
            quantity,
            currency,
            price,
            currency,
            round(price * quantity, 2),
            isin,
            inst_name,
            random.choice(venues),
            random.choice(countries),
            random.choice(short_indicators),
            business_date,
            random.choice(["pending", "validated"])
        ))
    
    cursor.executemany("""
        INSERT INTO mifir_transactions (
            transaction_reference, submitting_entity_lei, executing_entity_lei,
            investment_decision_within_firm, execution_within_firm,
            buyer_lei, buyer_first_name, buyer_surname, buyer_country,
            seller_lei, seller_first_name, seller_surname, seller_country,
            trading_date_time, trading_capacity,
            quantity, quantity_currency, price, price_currency, net_amount,
            instrument_isin, instrument_full_name, venue_mic, country_of_branch,
            short_selling_indicator, business_date, status
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, values)
    
    conn.commit()
    print(f"Inserted batch {batch + 1}/50 ({(batch + 1) * batch_size} records)")

cursor.execute("SELECT COUNT(*) FROM mifir_transactions")
count = cursor.fetchone()[0]
print(f"\nDone! Total transactions: {count}")

cursor.close()
conn.close()
