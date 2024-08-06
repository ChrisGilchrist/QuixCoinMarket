import os
from quixstreams import Application
from datetime import datetime
import json

# for local dev, load env vars from a .env file
from dotenv import load_dotenv
load_dotenv()

app = Application(consumer_group="hard-braking-v1", auto_offset_reset="earliest", use_changelog_topics=False)

input_topic = app.topic(os.environ["input"])
output_topic = app.topic(os.environ["output"])

sdf = app.dataframe(input_topic)

usd_to_gbp_rate = 0.78 # Example exchange rate
def convert_to_gbp(coin_value):
    usd_value = coin_value['quote']['USD']
    gbp_conversion = {
      'price': round(usd_value['price'] * usd_to_gbp_rate, 2),
      'volume_24h': round(usd_value['volume_24h'] * usd_to_gbp_rate, 2),
      'market_cap': round(usd_value['market_cap'] * usd_to_gbp_rate, 2)
    }
    coin_value['quote']['GBP'] = gbp_conversion

    return coin_value

sdf = (
    # Convert the temperature value from °F to °C
    # E.g. {"tempF": 68} will become {"tempC": 20}
    sdf.apply(lambda value: {iter(value): convert_to_gbp(value)})

    # Print the result to the console
    .update(print)
)


# Send the message to the output topic
sdf = sdf.to_topic(output_topic)

if __name__ == "__main__":
    app.run(sdf)