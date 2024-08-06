import os
from quixstreams import Application

# for local dev, load env vars from a .env file
from dotenv import load_dotenv
load_dotenv()

app = Application(consumer_group="coin-price-transformation", auto_offset_reset="earliest", use_changelog_topics=False)

input_topic = app.topic(os.environ["input"])
output_topic = app.topic(os.environ["output"])

sdf = app.dataframe(input_topic)

recent_prices = {}
def compareRecentPrices(coin_value):
    id = coin_value['symbol'].replace("'", "")
    price =  coin_value['quote']['GBP']['price']
    print('COINNNNn', price)
    
    # Check old price first 
    if id not in recent_prices:
      recent_prices[id] = {
          'price': 0,
          'status': ''
      }
      
    print('PRICE', recent_prices)
    oldPrice = recent_prices[id]['price']
    status = ''
    if (price > oldPrice):
        status = 'Increased'
    elif (price < oldPrice):
        status = 'Decreased'
    else:
        status = recent_prices[id]['status'];

    coin_value['quote']['GBP']['status'] = status
    # Update with current
    recent_prices[id] = {
        'price': price,
        'status': status
    }
    
    return coin_value


def updateCoinInfo(coin_value):
    new_coin_value = compareRecentPrices(coin_value)
    return new_coin_value  

sdf = (
    # Convert the temperature value from °F to °C
    # E.g. {"tempF": 68} will become {"tempC": 20}
    sdf.apply(lambda value: {
    next(iter(value.items()))[0]: updateCoinInfo(next(iter(value.items()))[1])
})
    # Print the result to the console
    .update(print)
)


# Send the message to the output topic
sdf = sdf.to_topic(output_topic)

if __name__ == "__main__":
    app.run(sdf)