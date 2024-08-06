import requests
import time
import os
import traceback
from quixstreams import Application

# for local dev, load env vars from a .env file
from dotenv import load_dotenv
load_dotenv()

url = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest'
headers = {
  'Accepts': 'application/json',
  'X-CMC_PRO_API_KEY': os.environ["API_KEY"]
}
app = Application(consumer_group="coin-data-source", auto_offset_reset="earliest")
output_topic = app.topic(os.environ["output"])

def main():
    # create a pre-configured Producer object.
    with app.get_producer() as producer:
        while True:
            try:
                response = requests.get(url, headers=headers)
                data_response = response.json()
                coins = data_response['data']

                for coin in coins:

                 # Serialize a coin using the topic
                  coin_data = output_topic.serialize(key=coin['symbol'], value=coin)

                  print(coin_data.key)
                  producer.produce(
                      topic=output_topic.name,
                      key=coin_data.key,
                      value=coin_data.value,
                  )
                time.sleep(2)  # Sleep (10 seconds)
            except Exception:
                print(traceback.format_exc())

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("Exiting.")