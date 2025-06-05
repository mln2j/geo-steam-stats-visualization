import json
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
import time

options = Options()
# options.add_argument("--headless")  # Okomentiraj za debugiranje
options.add_argument("--no-sandbox")

driver = webdriver.Chrome(options=options)
driver.get("https://store.steampowered.com/stats/content/")

WebDriverWait(driver, 15).until(
    EC.presence_of_element_located((By.CSS_SELECTOR, "svg"))
)

svg = driver.find_element(By.CSS_SELECTOR, "svg")
g_elem = svg.find_element(By.TAG_NAME, "g")
paths = g_elem.find_elements(By.TAG_NAME, "path")

print(f"Pronađeno država na karti: {len(paths)}")

results = []

for i, path in enumerate(paths):
    try:
        driver.execute_script("arguments[0].scrollIntoView(true);", path)
        ActionChains(driver).move_to_element(path).click().perform()
        time.sleep(0.5)
        country_name_elem = driver.find_element(By.XPATH, '/html/body/div[4]/div[2]/div/div[2]/div[2]/div[1]/div[4]/h2[1]/span')
        country_name = country_name_elem.text.strip()
        total_bytes = driver.find_element(By.ID, "regionTotalBytesTable").text.strip()
        avg_download_rate = driver.find_element(By.ID, "regionAvgMbpsTable").text.strip()
        percent_traffic = driver.find_element(By.ID, "regionPercentBytesTable").text.strip()
        if country_name:  # spremi samo ako ima ime
            results.append({
                "country": country_name,
                "total_bytes": total_bytes,
                "avg_download_rate": avg_download_rate,
                "percent_traffic": percent_traffic
            })
            print(f"{i+1}. {country_name} - Total Bytes: {total_bytes}, Avg Download Rate: {avg_download_rate}, Percentage of global Steam Traffic: {percent_traffic}")
    except Exception as e:
        print(f"Greška kod države {i+1}: {e}")

time.sleep(2)
driver.quit()

# Spremi rezultate u JSON datoteku
with open("steam_country_stats.json", "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=4)

print(f"\nPodaci su spremljeni u steam_country_stats.json ({len(results)} država)")
