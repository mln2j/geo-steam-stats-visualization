// script.js
function setCurrentYear() {
    const el = document.getElementById('current-year');
    if (el) el.textContent = new Date().getFullYear();
}

function initIndexPage() {
    setCurrentYear();
}

function initPlaytimeStats() {
    setCurrentYear();

    // Učitaj podatke i inicijaliziraj vizualizaciju
    d3.json("data/data.json", function(error, games) {
        if (error) throw error;

        var selectedIds = [];
        var color = d3.scale.category10();

        function renderGameList(filteredGames) {
            var list = d3.select("#game-list").selectAll(".game-list-item")
                .data(filteredGames, function(d) { return d.appId; });

            var enter = list.enter()
                .append("div")
                .attr("class", "game-list-item")
                .style("display", "flex")
                .style("align-items", "center");

            enter.append("input")
                .attr("type", "checkbox")
                .attr("class", "game-checkbox")
                .attr("id", function(d) { return "cb-" + d.appId; })
                .property("checked", function(d) { return selectedIds.indexOf(d.appId) !== -1; })
                .on("change", function(d) {
                    if (this.checked) {
                        if (selectedIds.indexOf(d.appId) === -1) selectedIds.push(d.appId);
                    } else {
                        var idx = selectedIds.indexOf(d.appId);
                        if (idx !== -1) selectedIds.splice(idx, 1);
                    }
                    updateChart();
                });

            enter.append("label")
                .attr("for", function(d) { return "cb-" + d.appId; })
                .text(function(d) { return d.name; })
                .style("margin-left", "8px");

            list.exit().remove();

            list.select("input.game-checkbox")
                .property("checked", function(d) { return selectedIds.indexOf(d.appId) !== -1; });
        }

        d3.select("#game-search").on("input", function() {
            var searchTerm = this.value.toLowerCase();
            var filtered = games.filter(function(g) {
                return g.name.toLowerCase().indexOf(searchTerm) !== -1;
            });
            renderGameList(filtered);
        });

        renderGameList(games);
        updateChart();

        function animateLine(path) {
            var totalLength = path.node().getTotalLength();
            path
                .attr("stroke-dasharray", totalLength + " " + totalLength)
                .attr("stroke-dashoffset", totalLength)
                .transition()
                .duration(800)
                .attr("stroke-dashoffset", 0);
        }

        function animateLineOut(path, callback) {
            var totalLength = path.node().getTotalLength();
            path
                .transition()
                .duration(600)
                .attr("stroke-dashoffset", totalLength)
                .remove();
            if (callback) callback();
        }

        function updateChart() {
            var margin = { top: 30, right: 80, bottom: 40, left: 60 },
                width = 800 - margin.left - margin.right,
                height = 400 - margin.top - margin.bottom;

            var svgContainer = d3.select("#playtime-chart").select("svg");
            if (svgContainer.empty()) {
                svgContainer = d3.select("#playtime-chart")
                    .append("svg")
                    .attr("width", width + margin.left + margin.right)
                    .attr("height", height + margin.top + margin.bottom)
                    .attr("viewBox", "0 0 " + (width) + " " + (height + margin.top + margin.bottom))
                    .attr("preserveAspectRatio", "xMidYMid meet");

                svgContainer.append("g")
                    .attr("class", "main-group")
                    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

                svgContainer.select(".main-group").append("g").attr("class", "x axis");
                svgContainer.select(".main-group").append("g").attr("class", "y axis");

                svgContainer.select(".main-group").append("text")
                    .attr("class", "y-label")
                    .attr("transform", "rotate(-90)")
                    .attr("y", -55)
                    .attr("x", -height / 2)
                    .attr("dy", "1em")
                    .style("text-anchor", "middle")
                    .style("font-size", "15px")
                    .text("Monthly Peak Players");

                svgContainer.select(".main-group").append("text")
                    .attr("class", "x-label")
                    .attr("x", width / 2)
                    .attr("y", height + 35)
                    .attr("text-anchor", "middle")
                    .style("font-size", "15px")
                    .text("Month");
            }

            var svg = svgContainer.select(".main-group");

            svg.selectAll("text.no-data-msg").remove();

            var selectedGames = games.filter(function (g) {
                return selectedIds.indexOf(g.appId) !== -1;
            });

            if (selectedGames.length === 0) {
                var x = d3.time.scale().range([0, width]);
                var y = d3.scale.linear().range([height, 0]);

                var xAxis = d3.svg.axis().scale(x).orient("bottom").ticks(10);
                var yAxis = d3.svg.axis().scale(y).orient("left");

                svg.select(".x.axis")
                    .transition().duration(750)
                    .attr("transform", "translate(0," + height + ")")
                    .call(xAxis);

                svg.select(".y.axis")
                    .transition().duration(750)
                    .call(yAxis);

                svg.selectAll("text.no-data-msg").remove();
                svg.append("text")
                    .attr("class", "no-data-msg")
                    .attr("x", width / 2)
                    .attr("y", height / 2)
                    .attr("text-anchor", "middle")
                    .text("Select one or more games to view playtime history.");

                d3.select("#legend").selectAll("*").remove();

                svg.selectAll(".line").remove();
                svg.selectAll(".dot").remove();

                return;
            }

            svg.selectAll(".hover-line").remove();
            svg.selectAll(".overlay-rect").remove();

            var hoverLine = svg.append("line")
                .attr("class", "hover-line")
                .attr("y1", 0)
                .attr("y2", height)
                .attr("stroke", "#999")
                .attr("stroke-width", 1)
                .attr("stroke-dasharray", "4 4")
                .style("opacity", 0);

            var overlay = svg.append("rect")
                .attr("class", "overlay-rect")
                .attr("width", width)
                .attr("height", height)
                .style("fill", "none")
                .style("pointer-events", "all")
                .on("mousemove", function () {
                    var mouse = d3.mouse(this);
                    var mouseX = mouse[0];
                    hoverLine
                        .attr("x1", mouseX)
                        .attr("x2", mouseX)
                        .style("opacity", 1);
                })
                .on("mouseout", function () {
                    hoverLine.style("opacity", 0);
                });

            var parseTime = d3.time.format("%B %Y");
            var allMonths = d3.set();

            svg.selectAll(".line").remove();
            svg.selectAll(".dot").remove();

            selectedGames.forEach(function (game) {
                game.monthlyPeakPlayers.forEach(function (mp) {
                    if (mp.month !== "Last 30 Days" && parseTime.parse(mp.month)) {
                        allMonths.add(mp.month);
                    }
                });
            });

            var months = allMonths.values().sort(function (a, b) {
                return parseTime.parse(a) - parseTime.parse(b);
            });

            if (months.length === 0) {
                svg.selectAll("*").remove();
                svg.append("text")
                    .attr("x", width / 2)
                    .attr("y", height / 2)
                    .attr("text-anchor", "middle")
                    .text("No valid monthly data available.");
                d3.select("#legend").selectAll("*").remove();
                return;
            }

            var x = d3.time.scale()
                .domain(d3.extent(months, function (m) { return parseTime.parse(m); }))
                .range([0, width]);

            var y = d3.scale.linear()
                .domain([0, d3.max(selectedGames, function (game) {
                    return d3.max(game.monthlyPeakPlayers, function (mp) { return mp.peakPlayers; });
                })])
                .range([height, 0]);

            var xAxis = d3.svg.axis().scale(x).orient("bottom").ticks(10);
            var yFormat = d3.format(".2s");
            var yAxis = d3.svg.axis().scale(y).orient("left").tickFormat(yFormat);

            svg.select(".x.axis")
                .transition().duration(750)
                .attr("transform", "translate(0," + height + ")")
                .call(xAxis)
                .selectAll("text")
                .style("font-family", "sans-serif")
                .style("font-size", "12px");

            svg.select(".y.axis")
                .transition().duration(750)
                .call(yAxis)
                .selectAll("text")
                .style("font-family", "sans-serif")
                .style("font-size", "12px");

            var line = d3.svg.line()
                .x(function (d) { return x(parseTime.parse(d.month)); })
                .y(function (d) { return y(d.peakPlayers); });

            var tooltip = d3.select("body").selectAll(".d3-tooltip").data([0]);
            tooltip = tooltip.enter()
                .append("div")
                .attr("class", "d3-tooltip")
                .style("opacity", 0)
                .merge ? tooltip : tooltip;

            svg.selectAll(".line")
                .filter(function () {
                    var id = d3.select(this).attr("data-id");
                    return selectedGames.map(g => g.appId + "").indexOf(id) === -1;
                })
                .each(function () { animateLineOut(d3.select(this)); });

            svg.selectAll(".dot")
                .filter(function () {
                    var id = d3.select(this).attr("data-gameid");
                    return selectedGames.map(g => g.appId + "").indexOf(id) === -1;
                })
                .transition().duration(400)
                .attr("r", 0)
                .style("opacity", 0)
                .remove();

            selectedGames.forEach(function (game, i) {
                var filteredData = game.monthlyPeakPlayers.filter(function (mp) {
                    return mp.month !== "Last 30 Days" && parseTime.parse(mp.month);
                });

                var lineId = "line-" + game.appId;
                if (!svg.select("#" + lineId).empty()) return;

                var path = svg.append("path")
                    .datum(filteredData)
                    .attr("class", "line")
                    .attr("id", lineId)
                    .attr("data-id", game.appId)
                    .attr("d", line)
                    .style("stroke", color(game.name))
                    .style("stroke-width", 2)
                    .style("fill", "none");

                animateLine(path);

                var dots = svg.selectAll(".dot-" + game.appId)
                    .data(filteredData)
                    .enter()
                    .append("circle")
                    .attr("class", "dot dot-" + game.appId)
                    .attr("data-gameid", game.appId)
                    .attr("cx", function (d) { return x(parseTime.parse(d.month)); })
                    .attr("cy", function (d) { return y(d.peakPlayers); })
                    .attr("r", 0)
                    .style("fill", color(game.name))
                    .style("opacity", 0)
                    .on("mouseover", function (d) {
                        d3.select(this)
                            .transition().duration(100)
                            .attr("r", 4);
                        tooltip.style("opacity", 0.95)
                            .html(
                                "<strong>" + game.name + "</strong><br>" +
                                d.month + "<br>" +
                                "Peak players: " + d.peakPlayers
                            )
                            .style("left", (d3.event.pageX + 15) + "px")
                            .style("top", (d3.event.pageY - 28) + "px");
                    })
                    .on("mousemove", function () {
                        tooltip.style("left", (d3.event.pageX + 15) + "px")
                            .style("top", (d3.event.pageY - 28) + "px");
                    })
                    .on("mouseout", function () {
                        d3.select(this)
                            .transition().duration(100)
                            .attr("r", 2);
                        tooltip.transition().duration(350).style("opacity", 0);
                    });

                dots.transition()
                    .delay(800)
                    .duration(400)
                    .attr("r", 2)
                    .style("opacity", 1);
            });

            var legendDiv = d3.select("#legend");
            legendDiv.selectAll("*").remove();

            selectedGames.forEach(function (game) {
                var item = legendDiv.append("div").attr("class", "legend-item");
                item.append("span")
                    .attr("class", "legend-color")
                    .style("background", color(game.name));
                item.append("span").text(game.name);
            });
        }
    });
}

function initPricingMap() {
    setCurrentYear();

    var width = 900, height = 500;

    var projection = d3.geo.mercator()
        .scale(140)
        .translate([width / 2, height / 1.5]);

    var path = d3.geo.path().projection(projection);

    var zoom = d3.behavior.zoom()
        .scaleExtent([1, 8])
        .on("zoom", zoomed);

    var svg = d3.select("#world-map").append("svg")
        .attr("width", width)
        .attr("height", height)
        .call(zoom)
        .append("g");

    function zoomed() {
        var t = d3.event.translate,
            s = d3.event.scale;
        zoom.translate(t);
        svg.attr("transform", "translate(" + t + ")scale(" + s + ")");
    }

    var tooltip = d3.select("body").append("div")
        .attr("class", "d3-tooltip")
        .style("opacity", 0);

    queue()
        .defer(d3.json, "data/data.json")
        .defer(d3.json, "data/steamCountries.json")
        .defer(d3.json, "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
        .await(ready);

    function ready(error, gameData, steamCountryStats, world) {
        if (error) throw error;

        let activeMetric = 'downloadRate';
        var statsByCountry = {};
        steamCountryStats.forEach(function (d) {
            statsByCountry[d.country] = d;
        });

        var countryToRegion = {};
        gameData.forEach(function (game) {
            if (game.regionalPrices) {
                Object.keys(game.regionalPrices).forEach(function (region) {
                    countryToRegion[region] = region;
                });
            }
        });

        var avgPriceByRegion = {};
        Object.keys(countryToRegion).forEach(function (region) {
            var prices = gameData.map(function (game) {
                var priceStr = game.regionalPrices[region];
                if (!priceStr) return null;
                var num = parseFloat(priceStr.replace(/[^\d,\.]/g, '').replace(',', '.'));
                return isNaN(num) ? null : num;
            }).filter(function (p) {
                return p !== null;
            });
            if (prices.length > 0) {
                avgPriceByRegion[region] = d3.mean(prices);
            }
        });

        var countries = topojson.feature(world, world.objects.countries).features;

        var speeds = steamCountryStats
            .map(function (d) {
                return parseFloat(d.avg_download_rate);
            })
            .filter(function (d) {
                return !isNaN(d);
            });
        var color = d3.scale.linear()
            .domain([d3.min(speeds), d3.max(speeds)])
            .range(["#cce5ff", "#003366"]);

        svg.selectAll("path")
            .data(countries)
            .enter().append("path")
            .attr("d", path)
            .attr("fill", function (d) {
                var stats = statsByCountry[d.properties.name];
                return stats && stats.avg_download_rate
                    ? color(parseFloat(stats.avg_download_rate))
                    : "#eee";
            })
            .attr("stroke", "#333")
            .attr("stroke-width", 0.5)
            .on("mouseover", function (d) {
                var stats = statsByCountry[d.properties.name];
                d3.select(this).attr("fill", "#3399ff");
                tooltip.transition().duration(100).style("opacity", 0.95);
                var region = stats && stats.regionCurrency ? stats.regionCurrency : d.properties.name;
                var avgPrice = avgPriceByRegion[region];

                tooltip.html(
                    `<strong>${d.properties.name}</strong><br>` +
                    (stats
                        ? `<strong>Avg. download rate:</strong> ${stats.avg_download_rate}<br>
                           <strong>Total bytes:</strong> ${stats.total_bytes}<br>
                           <strong>Traffic share:</strong> ${stats.percent_traffic}<br>` +
                        (avgPrice
                            ? `<strong>Avg. price (${region}):</strong> ${avgPrice.toFixed(2)}`
                            : `<strong>Avg. price:</strong> No data`)
                        : "No data")
                );

            })
            .on("mousemove", function () {
                tooltip.style("left", (d3.event.pageX + 15) + "px")
                    .style("top", (d3.event.pageY - 28) + "px");
            })
            .on("mouseout", function (d) {
                var stats = statsByCountry[d.properties.name];
                d3.select(this).attr("fill", stats && stats.avg_download_rate ? color(parseFloat(stats.avg_download_rate)) : "#eee");
                tooltip.transition().duration(200).style("opacity", 0);
            })
            .on("click", function (d) {
                var stats = statsByCountry[d.properties.name];
                var region = stats && stats.regionCurrency ? stats.regionCurrency : d.properties.name;
                showCountryStats(stats, avgPriceByRegion, region, d.properties.name);
            });

        var selectedCountries = [];
        var colors = [
            "#e41a1c", "#377eb8", "#4daf4a", "#984ea3",
            "#ff7f00", "#ffff33", "#a65628", "#f781bf",
            "#999999", "#66c2a5", "#fc8d62", "#8da0cb"
        ];

        var countryColor = function (i) {
            return colors[i % colors.length];
        };

        var countryColorMap = {};
        var colorIndex = 0;

        function getCountryColor(name) {
            if (!countryColorMap[name]) {
                countryColorMap[name] = countryColor(colorIndex++);
            }
            return countryColorMap[name];
        }

        function updateChart(dataKey) {
            const margin = { top: 30, right: 20, bottom: 30, left: 60 };
            const width = 400 - margin.left - margin.right;
            const barHeight = 30;
            const barSpacing = 5;

            const noSelectionMsg = d3.select("#no-selection-message");
            const statsTabs = d3.select("#stats-tabs");
            const combinedChart = d3.select("#combined-chart");
            const legend = d3.select("#legend");


            let barTooltip = d3.select("body").select("#bar-tooltip");
            if (barTooltip.empty()) {
                barTooltip = d3.select("body")
                    .append("div")
                    .attr("id", "bar-tooltip")
                    .attr("class", "d3-tooltip");
            }

            legend.selectAll("*").remove();

            if (selectedCountries.length === 0) {
                noSelectionMsg.style("display", "flex");
                statsTabs.style("display", "none");
                combinedChart.select("svg").remove();
                return;
            }

            noSelectionMsg.style("display", "none");
            statsTabs.style("display", "block");

            const height = selectedCountries.length * (barHeight + barSpacing);

            const getValue = d => {
                if (dataKey === 'downloadRate') return d.downloadRate || 0;
                if (dataKey === 'avgPrice') return d.avgPrice || 0;
                if (dataKey === 'totalData') return d.totalData || 0;
                return 0;
            };

            let svg = combinedChart.select("svg");
            if (svg.empty()) {
                svg = combinedChart.append("svg")
                    .attr("width", width + margin.left + margin.right)
                    .append("g")
                    .attr("class", "main-group")
                    .attr("transform", `translate(${margin.left},${margin.top})`);
            }

            combinedChart.select("svg")
                .attr("height", height + margin.top + margin.bottom);

            const mainGroup = combinedChart.select(".main-group");

            const xScale = d3.scale.linear()
                .domain([0, d3.max(selectedCountries, getValue)])
                .range([0, width]);

            const bars = mainGroup.selectAll("rect.bar")
                .data(selectedCountries, d => d.name);

            bars.exit()
                .transition().duration(500)
                .attr("width", 0)
                .remove();

            function formatValue(d) {
                if (dataKey === 'downloadRate') return d.downloadRate.toFixed(1) + " Mbps";
                if (dataKey === 'avgPrice') return "$" + d.avgPrice.toFixed(2);
                if (dataKey === 'totalData') return (d.totalData / (1024 * 1024 * 1024)).toFixed(2) + " GB";
                return "";
            }

            bars.enter()
                .append("rect")
                .attr("class", "bar")
                .attr("x", 0)
                .attr("y", (d, i) => i * (barHeight + barSpacing))
                .attr("height", barHeight)
                .attr("width", 0)
                .attr("fill", d => countryColorMap[d.name])
                .transition()
                .duration(800)
                .attr("width", d => xScale(getValue(d)));

            bars.transition()
                .duration(800)
                .attr("y", (d, i) => i * (barHeight + barSpacing))
                .attr("height", barHeight)
                .attr("width", d => xScale(getValue(d)))
                .attr("fill", d => countryColorMap[d.name]);

            bars.on("mouseover", function (d) {
                barTooltip.transition().duration(100).style("opacity", 1);
                barTooltip
                    .html(`<strong>${d.name}</strong><br>${formatValue(d)}`);
            })
                .on("mousemove", function () {
                    barTooltip
                        .style("left", (d3.event.pageX + 10) + "px")
                        .style("top", (d3.event.pageY - 20) + "px");
                })
                .on("mouseout", function () {
                    barTooltip.transition().duration(200).style("opacity", 0);
                });

            // X axis
            mainGroup.select(".x.axis").remove();

            const xAxis = d3.svg.axis()
                .scale(xScale)
                .orient("bottom")
                .ticks(4)
                .tickFormat(d => {
                    if (dataKey === 'downloadRate') return d.toFixed(1) + " Mbps";
                    if (dataKey === 'avgPrice') return "$" + d.toFixed(2);
                    if (dataKey === 'totalData') return (d / (1024 * 1024 * 1024)).toFixed(2) + " GB";
                    return d;
                });

            const xAxisGroup = mainGroup.append("g")
                .attr("class", "x axis")
                .attr("transform", `translate(0, ${height})`)
                .call(xAxis);

            xAxisGroup.select(".domain").style("stroke-width", "1px");
            xAxisGroup.selectAll("line").style("stroke-width", "1px");
            xAxisGroup.selectAll("text").style("font-size", "10px");

            xAxisGroup.selectAll("path,path,line")
                .attr("stroke-dasharray", function () {
                    const length = this.getTotalLength ? this.getTotalLength() : 0;
                    return `${length} ${length}`;
                })
                .attr("stroke-dashoffset", function () {
                    const length = this.getTotalLength ? this.getTotalLength() : 0;
                    return length;
                })
                .transition()
                .duration(800)
                .attr("stroke-dashoffset", 0);

            // Legend
            selectedCountries.forEach(country => {
                const item = legend.append("div").attr("class", "legend-item");
                item.append("span")
                    .attr("class", "legend-color")
                    .style("background", countryColorMap[country.name]);
                item.append("span").text(country.name);
            });
        }


        function showCountryStats(stats, avgPriceByRegion, region, countryName) {
            if (!stats) return;

            if (!countryColorMap[countryName]) {
                countryColorMap[countryName] = countryColor(Object.keys(countryColorMap).length);
            }

            var alreadyExists = selectedCountries.find(d => d.name === countryName);
            if (!alreadyExists) {
                selectedCountries.push({
                    name: countryName,
                    downloadRate: parseFloat(stats.avg_download_rate),
                    avgPrice: avgPriceByRegion[region] || null,
                    totalData: parseFloat(stats.total_bytes) || 0,
                    region: region
                });
            } else {
                var index = selectedCountries.findIndex(d => d.name === countryName);
                if (index !== -1) {
                    selectedCountries.splice(index, 1);
                }
            }

            d3.select("#no-selection-message").style("display", "none");
            d3.select("#stats-tabs").style("display", "block");

            updateChart(activeMetric);
        }

        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.getAttribute('data-tab');
                activeMetric = tabName;
                document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                updateChart(tabName);
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const bodyClass = document.body.className;

    if (bodyClass.includes('playtime-stats')) {
        initPlaytimeStats();
    } else if (bodyClass.includes('pricing-map')) {
        initPricingMap();
    } else if (bodyClass.includes('index')) {
        initIndexPage();
    }
});
