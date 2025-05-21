import requests
from bs4 import BeautifulSoup
import csv
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def parseInt(value):
    try:
        return int(value.replace(',', ''))
    except (ValueError, AttributeError):
        return None

def extractAppId(linkTag):
    if linkTag and '/app/' in linkTag.get('href', ''):
        return parseInt(linkTag['href'].split('/app/')[1].split('/')[0])
    return None

def parseGameRow(row):
    cols = row.find_all("td")
    if len(cols) < 6:
        return None
    linkTag = cols[1].find("a")
    return {
        "rank": parseInt(cols[0].text.strip().replace('.', '')),
        "appId": extractAppId(linkTag),
        "name": cols[1].text.strip(),
        "currentPlayers": parseInt(cols[2].text.strip()),
        "peakPlayers": parseInt(cols[4].text.strip()),
        "hoursPlayed": parseInt(cols[5].text.strip())
    }

def getSteamchartsTopGames(pages=1):
    games = []
    for page in range(1, pages + 1):
        url = f"https://steamcharts.com/top"
        if page > 1:
            url += f"/p.{page}"
        response = requests.get(url)
        if response.status_code != 200:
            continue
        soup = BeautifulSoup(response.text, "html.parser")
        table = soup.find("table", class_="common-table")
        if not table:
            continue
        rows = table.find_all("tr")[1:]
        for row in rows:
            game = parseGameRow(row)
            if game:
                games.append(game)
    return games

def getSteamdbPrices(appId):
    url = f"https://steamdb.info/app/{appId}/"
    options = Options()
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    driver = webdriver.Chrome(options=options)
    driver.get(url)
    try:
        WebDriverWait(driver, 200).until(
            EC.presence_of_element_located((By.CLASS_NAME, "table-prices"))
        )
    except Exception as e:
        driver.quit()
        return []
    time.sleep(15)
    soup = BeautifulSoup(driver.page_source, "html.parser")
    driver.quit()
    priceTable = soup.find("table", class_="table-prices")
    prices = []
    if priceTable:
        rows = priceTable.find_all("tr")
        for row in rows:
            cols = row.find_all("td")
            if len(cols) >= 3:
                region = cols[0].get_text(separator=" ", strip=True).replace('\xa0', ' ')
                convertedPrice = cols[2].get_text(separator=" ", strip=True).replace('\xa0', ' ')
                if convertedPrice and convertedPrice.lower() not in ['free', 'n/a', '-']:
                    prices.append({
                        "region": region,
                        "convertedPrice": convertedPrice
                    })
    print(f"Učitane cijene (convertedPrice) za appId {appId}:")
    for entry in prices:
        print(f"  {entry['region']}: {entry['convertedPrice']}")
    return prices

def isFreeToPlay(appId):
    url = f"https://store.steampowered.com/api/appdetails?appids={appId}"
    headers = {'User-Agent': 'Mozilla/5.0'}
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            data = response.json()
            app_data = data.get(str(appId), {}).get('data', {})
            return app_data.get('is_free', False)
    except Exception:
        pass
    return False

def isGameAvailableForSale(appId):
    url = f"https://store.steampowered.com/api/appdetails?appids={appId}"
    headers = {'User-Agent': 'Mozilla/5.0'}
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            data = response.json()
            app_data = data.get(str(appId), {}).get('data', {})
            if 'price_overview' in app_data:
                return True
            return False
    except Exception:
        return False

def saveToCsv(data, filename, priceRegions):
    fieldnames = [
        "rank", "appId", "name", "currentPlayers", "peakPlayers", "hoursPlayed"
    ] + priceRegions
    with open(filename, "w", encoding="utf-8", newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for game in data:
            row = {key: game.get(key) for key in fieldnames}
            if "regionalPrices" in game:
                for region in priceRegions:
                    row[region] = game["regionalPrices"].get(region)
            writer.writerow(row)

def main():
    topGames = getSteamchartsTopGames(pages=4)
    allRegions = set()
    for i, game in enumerate(topGames):
        appId = game["appId"]
        if not appId:
            continue
        print(f"[{i+1}/{len(topGames)}] {game['name']} (appId: {appId}) - provjera free2play i dostupnosti...")
        if isFreeToPlay(appId):
            print("Igra je free-to-play, preskačem dohvat cijena.")
            game["regionalPrices"] = {}
            continue
        if not isGameAvailableForSale(appId):
            print("Igra nije na prodaju, preskačem dohvat cijena.")
            game["regionalPrices"] = {}
            continue
        print("Dohvaćam cijene...")
        prices = getSteamdbPrices(appId)
        regionalPrices = {}
        for entry in prices:
            regionalPrices[entry["region"]] = entry["convertedPrice"]
            allRegions.add(entry["region"])
        game["regionalPrices"] = regionalPrices
        time.sleep(15)
        # if (i + 1) % 5 == 0:
        #     priceRegions = sorted(list(allRegions))
        #     saveToCsv(topGames, f"data_partial_{i+1}.csv", priceRegions)
        #     print(f"Spremljeno {i+1} igara u data_partial_{i+1}.csv")
    priceRegions = sorted(list(allRegions))
    saveToCsv(topGames, "data.csv", priceRegions)
    print(f"Dohvaćeno i spremljeno {len(topGames)} igara s cijenama po regijama.")

if __name__ == "__main__":
    main()
