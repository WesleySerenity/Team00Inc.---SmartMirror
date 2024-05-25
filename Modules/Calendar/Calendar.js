
Module.register("calendar", {
	// Define module defaults
	defaults: {
		maximumEntries: 10, // Total Maximum Entries
		maximumNumberOfDays: 365,
		limitDays: 0, // Limit the number of days shown, 0 = no limit
		pastDaysCount: 0,
		displaySymbol: true,
		defaultSymbol: "calendar-alt", 
		defaultSymbolClassName: "fas fa-fw fa-",
		showLocation: false,
		displayRepeatingCountTitle: false,
		defaultRepeatingCountTitle: "",
		maxTitleLength: 25,
		maxLocationTitleLength: 25,
		wrapEvents: false, // Wrap events to multiple lines breaking at maxTitleLength
		wrapLocationEvents: false,
		maxTitleLines: 3,
		maxEventTitleLines: 3,
		fetchInterval: 60 * 60 * 1000, // Update every hour
		animationSpeed: 2000,
		fade: true,
		fadePoint: 0.25, // Start on 1/4th of the list.
		urgency: 7,
		timeFormat: "relative",
		dateFormat: "MMM Do",
		dateEndFormat: "LT",
		fullDayEventDateFormat: "MMM Do",
		showEnd: false,
		getRelative: 6,
		hidePrivate: false,
		hideOngoing: false,
		hideTime: false,
		hideDuplicates: true,
		showTimeToday: false,
		colored: false,
		tableClass: "small",
		calendars: [
			{
				symbol: "calendar-alt",
				url: "https://www.calendarlabs.com/templates/ical/US-Holidays.ics"
			}
		],
		customEvents: [
			// Array of {keyword: "", symbol: "", color: "", eventClass: ""} where Keyword is a regexp and symbol/color/eventClass are to be applied for matched
			{ keyword: ".*", transform: { search: "De verjaardag van ", replace: "" } },
			{ keyword: ".*", transform: { search: "'s birthday", replace: "" } }
		],
		locationTitleReplace: {
			"street ": ""
		},
		broadcastEvents: true,
		excludedEvents: [],
		sliceMultiDayEvents: false,
		broadcastPastEvents: false,
		nextDaysRelative: false,
		selfSignedCert: false,
		coloredText: false,
		coloredBorder: false,
		coloredSymbol: false,
		coloredBackground: false,
		limitDaysNeverSkip: false,
		flipDateHeaderTitle: false,
		updateOnFetch: true
	},

	requiresVersion: "2.1.0",

	// Define required scripts.
	getStyles () {
		return ["calendar.css", "font-awesome.css"];
	},

	// Define required scripts.
	getScripts () {
		return ["calendarutils.js", "moment.js"];
	},

	// Define required translations.
	getTranslations () {
		
		return false;
	},

	// Override start method.
	start () {
		Log.info(`Starting module: ${this.name}`);

		if (this.config.colored) {
			Log.warn("Your are using the deprecated config values 'colored'. Please switch to  'coloredSymbol' & 'coloredText'!");
			this.config.coloredText = true;
			this.config.coloredSymbol = true;
		}
		if (this.config.coloredSymbolOnly) {
			Log.warn("Your are using the deprecated config values 'coloredSymbolOnly'. Please switch to  'coloredSymbol' & 'coloredText'!");
			this.config.coloredText = false;
			this.config.coloredSymbol = true;
		}

		// Set locale.
		moment.updateLocale(config.language, CalendarUtils.getLocaleSpecification(config.timeFormat));

		// clear data holder before start
		this.calendarData = {};

		// indicate no data available yet
		this.loaded = false;

		// data holder of calendar url. Avoid fade out/in on updateDom (one for each calendar update)
		this.calendarDisplayer = {};

		this.config.calendars.forEach((calendar) => {
			calendar.url = calendar.url.replace("webcal://", "http://");

			const calendarConfig = {
				maximumEntries: calendar.maximumEntries,
				maximumNumberOfDays: calendar.maximumNumberOfDays,
				pastDaysCount: calendar.pastDaysCount,
				broadcastPastEvents: calendar.broadcastPastEvents,
				selfSignedCert: calendar.selfSignedCert,
				excludedEvents: calendar.excludedEvents,
				fetchInterval: calendar.fetchInterval
			};

			if (typeof calendar.symbolClass === "undefined" || calendar.symbolClass === null) {
				calendarConfig.symbolClass = "";
			}
			if (typeof calendar.titleClass === "undefined" || calendar.titleClass === null) {
				calendarConfig.titleClass = "";
			}
			if (typeof calendar.timeClass === "undefined" || calendar.timeClass === null) {
				calendarConfig.timeClass = "";
			}

			
			if (calendar.user && calendar.pass) {
				Log.warn("Deprecation warning: Please update your calendar authentication configuration.");
				Log.warn("https://docs.magicmirror.builders/modules/calendar.html#configuration-options");
				calendar.auth = {
					user: calendar.user,
					pass: calendar.pass
				};
			}

			
			this.addCalendar(calendar.url, calendar.auth, calendarConfig);
		});

		
		if (typeof this.config.titleReplace !== "undefined") {
			Log.warn("Deprecation warning: Please consider upgrading your calendar titleReplace configuration to customEvents.");
			for (const [titlesearchstr, titlereplacestr] of Object.entries(this.config.titleReplace)) {
				this.config.customEvents.push({ keyword: ".*", transform: { search: titlesearchstr, replace: titlereplacestr } });
			}
		}

		this.selfUpdate();
	},

	
	socketNotificationReceived (notification, payload) {
		if (notification === "FETCH_CALENDAR") {
			this.sendSocketNotification(notification, { url: payload.url, id: this.identifier });
		}

		if (this.identifier !== payload.id) {
			return;
		}

		if (notification === "CALENDAR_EVENTS") {
			if (this.hasCalendarURL(payload.url)) {
				this.calendarData[payload.url] = payload.events;
				this.error = null;
				this.loaded = true;

				if (this.config.broadcastEvents) {
					this.broadcastEvents();
				}

				if (!this.config.updateOnFetch) {
					if (this.calendarDisplayer[payload.url] === undefined) {
						// calendar will never displayed, so display it
						this.updateDom(this.config.animationSpeed);
						// set this calendar as displayed
						this.calendarDisplayer[payload.url] = true;
					} else {
						Log.debug("[Calendar] DOM not updated waiting self update()");
					}
					return;
				}
			}
		} else if (notification === "CALENDAR_ERROR") {
			let error_message = this.translate(payload.error_type);
			this.error = this.translate("MODULE_CONFIG_ERROR", { MODULE_NAME: this.name, ERROR: error_message });
			this.loaded = true;
		}

		this.updateDom(this.config.animationSpeed);
	},

	
	getDom () {
		const ONE_SECOND = 1000; // 1,000 milliseconds
		const ONE_MINUTE = ONE_SECOND * 60;
		const ONE_HOUR = ONE_MINUTE * 60;
		const ONE_DAY = ONE_HOUR * 24;

		const events = this.createEventList(true);
		const wrapper = document.createElement("table");
		wrapper.className = this.config.tableClass;

		if (this.error) {
			wrapper.innerHTML = this.error;
			wrapper.className = `${this.config.tableClass} dimmed`;
			return wrapper;
		}

		if (events.length === 0) {
			wrapper.innerHTML = this.loaded ? this.translate("EMPTY") : this.translate("LOADING");
			wrapper.className = `${this.config.tableClass} dimmed`;
			return wrapper;
		}

		let currentFadeStep = 0;
		let startFade;
		let fadeSteps;

		if (this.config.fade && this.config.fadePoint < 1) {
			if (this.config.fadePoint < 0) {
				this.config.fadePoint = 0;
			}
			startFade = events.length * this.config.fadePoint;
			fadeSteps = events.length - startFade;
		}

		let lastSeenDate = "";

		events.forEach((event, index) => {
			const dateAsString = moment(event.startDate, "x").format(this.config.dateFormat);
			if (this.config.timeFormat === "dateheaders") {
				if (lastSeenDate !== dateAsString) {
					const dateRow = document.createElement("tr");
					dateRow.className = "dateheader normal";
					if (event.today) dateRow.className += " today";
					else if (event.dayBeforeYesterday) dateRow.className += " dayBeforeYesterday";
					else if (event.yesterday) dateRow.className += " yesterday";
					else if (event.tomorrow) dateRow.className += " tomorrow";
					else if (event.dayAfterTomorrow) dateRow.className += " dayAfterTomorrow";

					const dateCell = document.createElement("td");
					dateCell.colSpan = "3";
					dateCell.innerHTML = dateAsString;
					dateCell.style.paddingTop = "10px";
					dateRow.appendChild(dateCell);
					wrapper.appendChild(dateRow);

					if (this.config.fade && index >= startFade) {
						//fading
						currentFadeStep = index - startFade;
						dateRow.style.opacity = 1 - (1 / fadeSteps) * currentFadeStep;
					}

					lastSeenDate = dateAsString;
				}
			}

			const eventWrapper = document.createElement("tr");

			if (this.config.coloredText) {
				eventWrapper.style.cssText = `color:${this.colorForUrl(event.url, false)}`;
			}

			if (this.config.coloredBackground) {
				eventWrapper.style.backgroundColor = this.colorForUrl(event.url, true);
			}

			if (this.config.coloredBorder) {
				eventWrapper.style.borderColor = this.colorForUrl(event.url, false);
			}

			eventWrapper.className = "event-wrapper normal event";
			if (event.today) eventWrapper.className += " today";
			else if (event.dayBeforeYesterday) eventWrapper.className += " dayBeforeYesterday";
			else if (event.yesterday) eventWrapper.className += " yesterday";
			else if (event.tomorrow) eventWrapper.className += " tomorrow";
			else if (event.dayAfterTomorrow) eventWrapper.className += " dayAfterTomorrow";

			const symbolWrapper = document.createElement("td");

			if (this.config.displaySymbol) {
				if (this.config.coloredSymbol) {
					symbolWrapper.style.cssText = `color:${this.colorForUrl(event.url, false)}`;
				}

				const symbolClass = this.symbolClassForUrl(event.url);
				symbolWrapper.className = `symbol align-right ${symbolClass}`;

				const symbols = this.symbolsForEvent(event);
				symbols.forEach((s, index) => {
					const symbol = document.createElement("span");
					symbol.className = s;
					if (index > 0) {
						symbol.style.paddingLeft = "5px";
					}
					symbolWrapper.appendChild(symbol);
				});
				eventWrapper.appendChild(symbolWrapper);
			} else if (this.config.timeFormat === "dateheaders") {
				const blankCell = document.createElement("td");
				blankCell.innerHTML = "&nbsp;&nbsp;&nbsp;";
				eventWrapper.appendChild(blankCell);
			}

			const titleWrapper = document.createElement("td");
			let repeatingCountTitle = "";

			if (this.config.displayRepeatingCountTitle && event.firstYear !== undefined) {
				repeatingCountTitle = this.countTitleForUrl(event.url);

				if (repeatingCountTitle !== "") {
					const thisYear = new Date(parseInt(event.startDate)).getFullYear(),
						yearDiff = thisYear - event.firstYear;

					repeatingCountTitle = `, ${yearDiff} ${repeatingCountTitle}`;
				}
			}

			var transformedTitle = event.title;

			// Color events if custom color or eventClass are specified, transform title if required
			if (this.config.customEvents.length > 0) {
				for (let ev in this.config.customEvents) {
					let needle = new RegExp(this.config.customEvents[ev].keyword, "gi");
					if (needle.test(event.title)) {
						if (typeof this.config.customEvents[ev].transform === "object") {
							transformedTitle = CalendarUtils.titleTransform(transformedTitle, [this.config.customEvents[ev].transform]);
						}
						if (typeof this.config.customEvents[ev].color !== "undefined" && this.config.customEvents[ev].color !== "") {
							// Respect parameter ColoredSymbolOnly also for custom events
							if (this.config.coloredText) {
								eventWrapper.style.cssText = `color:${this.config.customEvents[ev].color}`;
								titleWrapper.style.cssText = `color:${this.config.customEvents[ev].color}`;
							}
							if (this.config.displaySymbol && this.config.coloredSymbol) {
								symbolWrapper.style.cssText = `color:${this.config.customEvents[ev].color}`;
							}
						}
						if (typeof this.config.customEvents[ev].eventClass !== "undefined" && this.config.customEvents[ev].eventClass !== "") {
							eventWrapper.className += ` ${this.config.customEvents[ev].eventClass}`;
						}
					}
				}
			}

			titleWrapper.innerHTML = CalendarUtils.shorten(transformedTitle, this.config.maxTitleLength, this.config.wrapEvents, this.config.maxTitleLines) + repeatingCountTitle;

			const titleClass = this.titleClassForUrl(event.url);

			if (!this.config.coloredText) {
				titleWrapper.className = `title bright ${titleClass}`;
			} else {
				titleWrapper.className = `title ${titleClass}`;
			}

			if (this.config.timeFormat === "dateheaders") {
				if (this.config.flipDateHeaderTitle) eventWrapper.appendChild(titleWrapper);

				if (event.fullDayEvent) {
					titleWrapper.colSpan = "2";
					titleWrapper.classList.add("align-left");
				} else {
					const timeWrapper = document.createElement("td");
					timeWrapper.className = `time light ${this.config.flipDateHeaderTitle ? "align-right " : "align-left "}${this.timeClassForUrl(event.url)}`;
					timeWrapper.style.paddingLeft = "2px";
					timeWrapper.style.textAlign = this.config.flipDateHeaderTitle ? "right" : "left";
					timeWrapper.innerHTML = moment(event.startDate, "x").format("LT");

					// Add endDate to dataheaders if showEnd is enabled
					if (this.config.showEnd) {
						timeWrapper.innerHTML += ` - ${CalendarUtils.capFirst(moment(event.endDate, "x").format("LT"))}`;
					}

					eventWrapper.appendChild(timeWrapper);

					if (!this.config.flipDateHeaderTitle) titleWrapper.classList.add("align-right");
				}
				if (!this.config.flipDateHeaderTitle) eventWrapper.appendChild(titleWrapper);
			} else {
				const timeWrapper = document.createElement("td");

				eventWrapper.appendChild(titleWrapper);
				const now = new Date();

				if (this.config.timeFormat === "absolute") {
					
					timeWrapper.innerHTML = CalendarUtils.capFirst(moment(event.startDate, "x").format(this.config.dateFormat));
					
					if (this.config.showEnd) {
						timeWrapper.innerHTML += "-";
						timeWrapper.innerHTML += CalendarUtils.capFirst(moment(event.endDate, "x").format(this.config.dateEndFormat));
					}
					
					if (event.fullDayEvent) {
						
						event.endDate -= ONE_SECOND;
						timeWrapper.innerHTML = CalendarUtils.capFirst(moment(event.startDate, "x").format(this.config.fullDayEventDateFormat));
					} else if (this.config.getRelative > 0 && event.startDate < now) {
						
						timeWrapper.innerHTML = CalendarUtils.capFirst(
							this.translate("RUNNING", {
								fallback: `${this.translate("RUNNING")} {timeUntilEnd}`,
								timeUntilEnd: moment(event.endDate, "x").fromNow(true)
							})
						);
					} else if (this.config.urgency > 0 && event.startDate - now < this.config.urgency * ONE_DAY) {
						
						timeWrapper.innerHTML = CalendarUtils.capFirst(moment(event.startDate, "x").fromNow());
					}
					if (event.fullDayEvent && this.config.nextDaysRelative) {
						
						if (event.today) {
							timeWrapper.innerHTML = CalendarUtils.capFirst(this.translate("TODAY"));
						} else if (event.yesterday) {
							timeWrapper.innerHTML = CalendarUtils.capFirst(this.translate("YESTERDAY"));
						} else if (event.startDate - now < ONE_DAY && event.startDate - now > 0) {
							timeWrapper.innerHTML = CalendarUtils.capFirst(this.translate("TOMORROW"));
						} else if (event.startDate - now < 2 * ONE_DAY && event.startDate - now > 0) {
							if (this.translate("DAYAFTERTOMORROW") !== "DAYAFTERTOMORROW") {
								timeWrapper.innerHTML = CalendarUtils.capFirst(this.translate("DAYAFTERTOMORROW"));
							}
						}
					}
				} else {
					
					if (event.startDate >= now || (event.fullDayEvent && event.today)) {
						// Use relative time
						if (!this.config.hideTime && !event.fullDayEvent) {
							timeWrapper.innerHTML = CalendarUtils.capFirst(moment(event.startDate, "x").calendar(null, { sameElse: this.config.dateFormat }));
						} else {
							timeWrapper.innerHTML = CalendarUtils.capFirst(
								moment(event.startDate, "x").calendar(null, {
									sameDay: this.config.showTimeToday ? "LT" : `[${this.translate("TODAY")}]`,
									nextDay: `[${this.translate("TOMORROW")}]`,
									nextWeek: "dddd",
									sameElse: event.fullDayEvent ? this.config.fullDayEventDateFormat : this.config.dateFormat
								})
							);
						}
						if (event.fullDayEvent) {
							// Full days events within the next two days
							if (event.today) {
								timeWrapper.innerHTML = CalendarUtils.capFirst(this.translate("TODAY"));
							} else if (event.dayBeforeYesterday) {
								if (this.translate("DAYBEFOREYESTERDAY") !== "DAYBEFOREYESTERDAY") {
									timeWrapper.innerHTML = CalendarUtils.capFirst(this.translate("DAYBEFOREYESTERDAY"));
								}
							} else if (event.yesterday) {
								timeWrapper.innerHTML = CalendarUtils.capFirst(this.translate("YESTERDAY"));
							} else if (event.startDate - now < ONE_DAY && event.startDate - now > 0) {
								timeWrapper.innerHTML = CalendarUtils.capFirst(this.translate("TOMORROW"));
							} else if (event.startDate - now < 2 * ONE_DAY && event.startDate - now > 0) {
								if (this.translate("DAYAFTERTOMORROW") !== "DAYAFTERTOMORROW") {
									timeWrapper.innerHTML = CalendarUtils.capFirst(this.translate("DAYAFTERTOMORROW"));
								}
							}
						} else if (event.startDate - now < this.config.getRelative * ONE_HOUR) {
							// If event is within getRelative hours, display 'in xxx' time format or moment.fromNow()
							timeWrapper.innerHTML = CalendarUtils.capFirst(moment(event.startDate, "x").fromNow());
						}
					} else {
						// Ongoing event
						timeWrapper.innerHTML = CalendarUtils.capFirst(
							this.translate("RUNNING", {
								fallback: `${this.translate("RUNNING")} {timeUntilEnd}`,
								timeUntilEnd: moment(event.endDate, "x").fromNow(true)
							})
						);
					}
				}
				timeWrapper.className = `time light ${this.timeClassForUrl(event.url)}`;
				eventWrapper.appendChild(timeWrapper);
			}

			// Create fade effect.
			if (index >= startFade) {
				currentFadeStep = index - startFade;
				eventWrapper.style.opacity = 1 - (1 / fadeSteps) * currentFadeStep;
			}
			wrapper.appendChild(eventWrapper);

			if (this.config.showLocation) {
				if (event.location !== false) {
					const locationRow = document.createElement("tr");
					locationRow.className = "event-wrapper-location normal xsmall light";
					if (event.today) locationRow.className += " today";
					else if (event.dayBeforeYesterday) locationRow.className += " dayBeforeYesterday";
					else if (event.yesterday) locationRow.className += " yesterday";
					else if (event.tomorrow) locationRow.className += " tomorrow";
					else if (event.dayAfterTomorrow) locationRow.className += " dayAfterTomorrow";

					if (this.config.displaySymbol) {
						const symbolCell = document.createElement("td");
						locationRow.appendChild(symbolCell);
					}

					if (this.config.coloredText) {
						locationRow.style.cssText = `color:${this.colorForUrl(event.url, false)}`;
					}

					if (this.config.coloredBackground) {
						locationRow.style.backgroundColor = this.colorForUrl(event.url, true);
					}

					if (this.config.coloredBorder) {
						locationRow.style.borderColor = this.colorForUrl(event.url, false);
					}

					const descCell = document.createElement("td");
					descCell.className = "location";
					descCell.colSpan = "2";

					const transformedTitle = CalendarUtils.titleTransform(event.location, this.config.locationTitleReplace);
					descCell.innerHTML = CalendarUtils.shorten(transformedTitle, this.config.maxLocationTitleLength, this.config.wrapLocationEvents, this.config.maxEventTitleLines);
					locationRow.appendChild(descCell);

					wrapper.appendChild(locationRow);

					if (index >= startFade) {
						currentFadeStep = index - startFade;
						locationRow.style.opacity = 1 - (1 / fadeSteps) * currentFadeStep;
					}
				}
			}
		});

		return wrapper;
	},

	/**
	 * Checks if this config contains the calendar url.
	 * @param {string} url The calendar url
	 * @returns {boolean} True if the calendar config contains the url, False otherwise
	 */
	hasCalendarURL (url) {
		for (const calendar of this.config.calendars) {
			if (calendar.url === url) {
				return true;
			}
		}

		return false;
	},

	
	createEventList (limitNumberOfEntries) {
		const ONE_SECOND = 1000; // 1,000 milliseconds
		const ONE_MINUTE = ONE_SECOND * 60;
		const ONE_HOUR = ONE_MINUTE * 60;
		const ONE_DAY = ONE_HOUR * 24;

		const now = new Date();
		const today = moment().startOf("day");
		const future = moment().startOf("day").add(this.config.maximumNumberOfDays, "days").toDate();
		let events = [];

		for (const calendarUrl in this.calendarData) {
			const calendar = this.calendarData[calendarUrl];
			let remainingEntries = this.maximumEntriesForUrl(calendarUrl);
			let maxPastDaysCompare = now - this.maximumPastDaysForUrl(calendarUrl) * ONE_DAY;
			for (const e in calendar) {
				const event = JSON.parse(JSON.stringify(calendar[e])); // clone object

				if (this.config.hidePrivate && event.class === "PRIVATE") {
					// do not add the current event, skip it
					continue;
				}
				if (limitNumberOfEntries) {
					if (event.endDate < maxPastDaysCompare) {
						continue;
					}
					if (this.config.hideOngoing && event.startDate < now) {
						continue;
					}
					if (this.config.hideDuplicates && this.listContainsEvent(events, event)) {
						continue;
					}
					if (--remainingEntries < 0) {
						break;
					}
				}

				event.url = calendarUrl;
				event.today = event.startDate >= today && event.startDate < today + ONE_DAY;
				event.dayBeforeYesterday = event.startDate >= today - ONE_DAY * 2 && event.startDate < today - ONE_DAY;
				event.yesterday = event.startDate >= today - ONE_DAY && event.startDate < today;
				event.tomorrow = !event.today && event.startDate >= today + ONE_DAY && event.startDate < today + 2 * ONE_DAY;
				event.dayAfterTomorrow = !event.tomorrow && event.startDate >= today + ONE_DAY * 2 && event.startDate < today + 3 * ONE_DAY;

				
				const maxCount = Math.ceil((event.endDate - 1 - moment(event.startDate, "x").endOf("day").format("x")) / ONE_DAY) + 1;
				if (this.config.sliceMultiDayEvents && maxCount > 1) {
					const splitEvents = [];
					let midnight
						= moment(event.startDate, "x")
							.clone()
							.startOf("day")
							.add(1, "day")
							.format("x");
					let count = 1;
					while (event.endDate > midnight) {
						const thisEvent = JSON.parse(JSON.stringify(event)); // clone object
						thisEvent.today = thisEvent.startDate >= today && thisEvent.startDate < today + ONE_DAY;
						thisEvent.tomorrow = !thisEvent.today && thisEvent.startDate >= today + ONE_DAY && thisEvent.startDate < today + 2 * ONE_DAY;
						thisEvent.endDate = midnight;
						thisEvent.title += ` (${count}/${maxCount})`;
						splitEvents.push(thisEvent);

						event.startDate = midnight;
						count += 1;
						midnight = moment(midnight, "x").add(1, "day").format("x"); // next day
					}
					// Last day
					event.title += ` (${count}/${maxCount})`;
					event.today += event.startDate >= today && event.startDate < today + ONE_DAY;
					event.tomorrow = !event.today && event.startDate >= today + ONE_DAY && event.startDate < today + 2 * ONE_DAY;
					splitEvents.push(event);

					for (let splitEvent of splitEvents) {
						if (splitEvent.endDate > now && splitEvent.endDate <= future) {
							events.push(splitEvent);
						}
					}
				} else {
					events.push(event);
				}
			}
		}

		events.sort(function (a, b) {
			return a.startDate - b.startDate;
		});

		if (!limitNumberOfEntries) {
			return events;
		}

		
		if (this.config.limitDays > 0) {
			let newEvents = [];
			let lastDate = today.clone().subtract(1, "days").format("YYYYMMDD");
			let days = 0;
			for (const ev of events) {
				let eventDate = moment(ev.startDate, "x").format("YYYYMMDD");
				
				if (eventDate > lastDate) {
					
					if (!this.config.limitDaysNeverSkip && newEvents.length === 1 && days === 1 && newEvents[0].fullDayEvent) {
						days--;
					}
					days++;
					if (days > this.config.limitDays) {
						continue;
					} else {
						lastDate = eventDate;
					}
				}
				newEvents.push(ev);
			}
			events = newEvents;
		}

		return events.slice(0, this.config.maximumEntries);
	},

	listContainsEvent (eventList, event) {
		for (const evt of eventList) {
			if (evt.title === event.title && parseInt(evt.startDate) === parseInt(event.startDate) && parseInt(evt.endDate) === parseInt(event.endDate)) {
				return true;
			}
		}
		return false;
	},

	
	addCalendar (url, auth, calendarConfig) {
		this.sendSocketNotification("ADD_CALENDAR", {
			id: this.identifier,
			url: url,
			excludedEvents: calendarConfig.excludedEvents || this.config.excludedEvents,
			maximumEntries: calendarConfig.maximumEntries || this.config.maximumEntries,
			maximumNumberOfDays: calendarConfig.maximumNumberOfDays || this.config.maximumNumberOfDays,
			pastDaysCount: calendarConfig.pastDaysCount || this.config.pastDaysCount,
			fetchInterval: calendarConfig.fetchInterval || this.config.fetchInterval,
			symbolClass: calendarConfig.symbolClass,
			titleClass: calendarConfig.titleClass,
			timeClass: calendarConfig.timeClass,
			auth: auth,
			broadcastPastEvents: calendarConfig.broadcastPastEvents || this.config.broadcastPastEvents,
			selfSignedCert: calendarConfig.selfSignedCert || this.config.selfSignedCert
		});
	},

	
	symbolsForEvent (event) {
		let symbols = this.getCalendarPropertyAsArray(event.url, "symbol", this.config.defaultSymbol);

		if (event.recurringEvent === true && this.hasCalendarProperty(event.url, "recurringSymbol")) {
			symbols = this.mergeUnique(this.getCalendarPropertyAsArray(event.url, "recurringSymbol", this.config.defaultSymbol), symbols);
		}

		if (event.fullDayEvent === true && this.hasCalendarProperty(event.url, "fullDaySymbol")) {
			symbols = this.mergeUnique(this.getCalendarPropertyAsArray(event.url, "fullDaySymbol", this.config.defaultSymbol), symbols);
		}

		// If custom symbol is set, replace event symbol
		for (let ev of this.config.customEvents) {
			if (typeof ev.symbol !== "undefined" && ev.symbol !== "") {
				let needle = new RegExp(ev.keyword, "gi");
				if (needle.test(event.title)) {
					// Get the default prefix for this class name and add to the custom symbol provided
					const className = this.getCalendarProperty(event.url, "symbolClassName", this.config.defaultSymbolClassName);
					symbols[0] = className + ev.symbol;
					break;
				}
			}
		}

		return symbols;
	},

	mergeUnique (arr1, arr2) {
		return arr1.concat(
			arr2.filter(function (item) {
				return arr1.indexOf(item) === -1;
			})
		);
	},

	
	symbolClassForUrl (url) {
		return this.getCalendarProperty(url, "symbolClass", "");
	},


	titleClassForUrl (url) {
		return this.getCalendarProperty(url, "titleClass", "");
	},

	
	timeClassForUrl (url) {
		return this.getCalendarProperty(url, "timeClass", "");
	},


	calendarNameForUrl (url) {
		return this.getCalendarProperty(url, "name", "");
	},

	
	colorForUrl (url, isBg) {
		return this.getCalendarProperty(url, isBg ? "bgColor" : "color", "#fff");
	},

	countTitleForUrl (url) {
		return this.getCalendarProperty(url, "repeatingCountTitle", this.config.defaultRepeatingCountTitle);
	},

	
	maximumEntriesForUrl (url) {
		return this.getCalendarProperty(url, "maximumEntries", this.config.maximumEntries);
	},

	
	maximumPastDaysForUrl (url) {
		return this.getCalendarProperty(url, "pastDaysCount", this.config.pastDaysCount);
	},

	
	getCalendarProperty (url, property, defaultValue) {
		for (const calendar of this.config.calendars) {
			if (calendar.url === url && calendar.hasOwnProperty(property)) {
				return calendar[property];
			}
		}

		return defaultValue;
	},

	getCalendarPropertyAsArray (url, property, defaultValue) {
		let p = this.getCalendarProperty(url, property, defaultValue);
		if (property === "symbol" || property === "recurringSymbol" || property === "fullDaySymbol") {
			const className = this.getCalendarProperty(url, "symbolClassName", this.config.defaultSymbolClassName);
			p = className + p;
		}

		if (!(p instanceof Array)) p = [p];
		return p;
	},

	hasCalendarProperty (url, property) {
		return !!this.getCalendarProperty(url, property, undefined);
	},

	
	broadcastEvents () {
		const eventList = this.createEventList(false);
		for (const event of eventList) {
			event.symbol = this.symbolsForEvent(event);
			event.calendarName = this.calendarNameForUrl(event.url);
			event.color = this.colorForUrl(event.url, false);
			delete event.url;
		}

		this.sendNotification("CALENDAR_EVENTS", eventList);
	},

	
	selfUpdate () {
		const ONE_MINUTE = 60 * 1000;
		setTimeout(
			() => {
				setInterval(() => {
					Log.debug("[Calendar] self update");
					if (this.config.updateOnFetch) {
						this.updateDom(1);
					} else {
						this.updateDom(this.config.animationSpeed);
					}
				}, ONE_MINUTE);
			},
			ONE_MINUTE - (new Date() % ONE_MINUTE)
		);
	}
});
