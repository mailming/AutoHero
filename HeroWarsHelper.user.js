// ==UserScript==
// @name			HeroWarsHelper
// @name:en			HeroWarsHelper
// @name:ru			HeroWarsHelper
// @namespace		HeroWarsHelper
// @version			2.376
// @description		Automation of actions for the game Hero Wars
// @description:en	Automation of actions for the game Hero Wars
// @description:ru	Автоматизация действий для игры Хроники Хаоса
// @author			ZingerY
// @license 		Copyright ZingerY
// @homepage		https://zingery.ru/scripts/HeroWarsHelper.user.js
// @icon			https://zingery.ru/scripts/VaultBoyIco16.ico
// @icon64			https://zingery.ru/scripts/VaultBoyIco64.png
// @match			https://www.hero-wars.com/*
// @match			https://apps-1701433570146040.apps.fbsbx.com/*
// @run-at			document-start
// @downloadURL https://update.greasyfork.org/scripts/450693/HeroWarsHelper.user.js
// @updateURL https://github.com/mailming/AutoHero/raw/refs/heads/develop/HeroWarsHelper.user.js
// ==/UserScript==

(function() {
	/**
	 * Start script
	 *
	 * Стартуем скрипт
	 */
	console.log('%cStart ' + GM_info.script.name + ', v' + GM_info.script.version + ' by ' + GM_info.script.author, 'color: red');
	/**
	 * Script info
	 *
	 * Информация о скрипте
	 */
	this.scriptInfo = (({name, version, author, homepage, lastModified}, updateUrl) =>
		({name, version, author, homepage, lastModified, updateUrl}))
		(GM_info.script, GM_info.scriptUpdateURL);
	this.GM_info = GM_info;
	/**
	 * Information for completing daily quests
	 *
	 * Информация для выполнения ежендевных квестов
	 */
	const questsInfo = {};
	/**
	 * Is the game data loaded
	 *
	 * Загружены ли данные игры
	 */
	let isLoadGame = false;
	/**
	 * Headers of the last request
	 *
	 * Заголовки последнего запроса
	 */
	let lastHeaders = {};
	/**
	 * Information about sent gifts
	 *
	 * Информация об отправленных подарках
	 */
	let freebieCheckInfo = null;
	/**
	 * missionTimer
	 *
	 * missionTimer
	 */
	let missionBattle = null;
	/**
	 * User data
	 *
	 * Данные пользователя
	 */
	let userInfo;
	this.isTimeBetweenNewDays = function () {
		if (userInfo.timeZone <= 3) {
			return false;
		}
		const nextDayTs = new Date(userInfo.nextDayTs * 1e3);
		const nextServerDayTs = new Date(userInfo.nextServerDayTs * 1e3);
		if (nextDayTs > nextServerDayTs) {
			nextDayTs.setDate(nextDayTs.getDate() - 1);
		}
		const now = Date.now();
		if (now > nextDayTs && now < nextServerDayTs) {
			return true;
		}
		return false;
	};

	function getUserInfo() {
		return userInfo;
	}
	/**
	 * Original methods for working with AJAX
	 *
	 * Оригинальные методы для работы с AJAX
	 */
	const original = {
		open: XMLHttpRequest.prototype.open,
		send: XMLHttpRequest.prototype.send,
		setRequestHeader: XMLHttpRequest.prototype.setRequestHeader,
		SendWebSocket: WebSocket.prototype.send,
		fetch: fetch,
	};

	// Enhanced API monitoring
	function captureAllAPICalls() {
		// Override console.log to capture API calls
		const originalLog = console.log;
		console.log = function(...args) {
			if (args[0] && typeof args[0] === 'string' && args[0].includes('API')) {
				// Send to external monitoring system
				window.postMessage({
					type: 'API_CALL',
					data: args
				}, '*');
			}
			return originalLog.apply(console, args);
		};

		// Also monitor the game's Send function specifically
		if (window.Send) {
			const originalSend = window.Send;
			window.Send = function(data) {
				// Log the API call
				console.log('🚀 API REQUEST:', {
					timestamp: new Date().toISOString(),
					data: data,
					stack: new Error().stack
				});

				// Send to monitoring system
				window.postMessage({
					type: 'API_CALL',
					data: data,
					timestamp: Date.now()
				}, '*');

				return originalSend.call(this, data);
			};
		}

		console.log('✅ API monitoring activated');
	}

	// Activate API monitoring
	captureAllAPICalls();

	// Sentry blocking
	// Блокировка наблюдателя
	this.fetch = function (url, options) {
		/**
		 * Checking URL for blocking
		 * Проверяем URL на блокировку
		 */
		if (url.includes('sentry.io')) {
			console.log('%cFetch blocked', 'color: red');
			console.log(url, options);
			const body = {
				id: md5(Date.now()),
			};
			let info = {};
			try {
				info = JSON.parse(options.body);
			} catch (e) {}
			if (info.event_id) {
				body.id = info.event_id;
			}
			/**
			 * Mock response for blocked URL
			 *
			 * Мокаем ответ для заблокированного URL
			 */
			const mockResponse = new Response('Custom blocked response', {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
				body,
			});
			return Promise.resolve(mockResponse);
		} else {
			/**
			 * Call the original fetch function for all other URLs
			 * Вызываем оригинальную функцию fetch для всех других URL
			 */
			return original.fetch.apply(this, arguments);
		}
	};

	/**
	 * Decoder for converting byte data to JSON string
	 *
	 * Декодер для перобразования байтовых данных в JSON строку
	 */
	const decoder = new TextDecoder("utf-8");
	/**
	 * Stores a history of requests
	 *
	 * Хранит историю запросов
	 */
	let requestHistory = {};
	/**
	 * URL for API requests
	 *
	 * URL для запросов к API
	 */
	let apiUrl = '';

	/**
	 * Connecting to the game code
	 *
	 * Подключение к коду игры
	 */
	this.cheats = new hackGame();
	/**
	 * The function of calculating the results of the battle
	 *
	 * Функция расчета результатов боя
	 */
	this.BattleCalc = cheats.BattleCalc;
	/**
	 * Sending a request available through the console
	 *
	 * Отправка запроса доступная через консоль
	 */
	this.SendRequest = send;
	/**
	 * Simple combat calculation available through the console
	 *
	 * Простой расчет боя доступный через консоль
	 */
	this.Calc = function (data) {
		const type = getBattleType(data?.type);
		return new Promise((resolve, reject) => {
			try {
				BattleCalc(data, type, resolve);
			} catch (e) {
				reject(e);
			}
		})
	}
	/**
	 * Short asynchronous request
	 * Usage example (returns information about a character):
	 * const userInfo = await Send('{"calls":[{"name":"userGetInfo","args":{},"ident":"body"}]}')
	 *
	 * Короткий асинхронный запрос
	 * Пример использования (возвращает информацию о персонаже):
	 * const userInfo = await Send('{"calls":[{"name":"userGetInfo","args":{},"ident":"body"}]}')
	*/
	this.Send = function (json, pr) {
		return new Promise((resolve, reject) => {
			try {
				send(json, resolve, pr);
			} catch (e) {
				reject(e);
			}
		})
	}

	this.xyz = (({ name, version, author }) => ({ name, version, author }))(GM_info.script);
	const i18nLangData = {
		/* English translation by BaBa */
		en: {
			/* Checkboxes */
			SKIP_FIGHTS: 'Skip battle',
			SKIP_FIGHTS_TITLE: 'Skip battle in Outland and the arena of the titans, auto-pass in the tower and campaign',
			ENDLESS_CARDS: 'Infinite cards',
			ENDLESS_CARDS_TITLE: 'Disable Divination Cards wasting',
			AUTO_EXPEDITION: 'Auto Expedition',
			AUTO_EXPEDITION_TITLE: 'Auto-sending expeditions',
			CANCEL_FIGHT: 'Cancel battle',
			CANCEL_FIGHT_TITLE: 'Ability to cancel manual combat on GW, CoW and Asgard',
			GIFTS: 'Gifts',
			GIFTS_TITLE: 'Collect gifts automatically',
			BATTLE_RECALCULATION: 'Battle recalculation',
			BATTLE_RECALCULATION_TITLE: 'Preliminary calculation of the battle',
			QUANTITY_CONTROL: 'Quantity control',
			QUANTITY_CONTROL_TITLE: 'Ability to specify the number of opened "lootboxes"',
			REPEAT_CAMPAIGN: 'Repeat missions',
			REPEAT_CAMPAIGN_TITLE: 'Auto-repeat battles in the campaign',
			DISABLE_DONAT: 'Disable donation',
			DISABLE_DONAT_TITLE: 'Removes all donation offers',
			DAILY_QUESTS: 'Quests',
			DAILY_QUESTS_TITLE: 'Complete daily quests',
			AUTO_QUIZ: 'AutoQuiz',
			AUTO_QUIZ_TITLE: 'Automatically receive correct answers to quiz questions',
			SECRET_WEALTH_CHECKBOX: 'Automatic purchase in the store "Secret Wealth" when entering the game',
			HIDE_SERVERS: 'Collapse servers',
			HIDE_SERVERS_TITLE: 'Hide unused servers',
			/* Input fields */
			HOW_MUCH_TITANITE: 'How much titanite to farm',
			COMBAT_SPEED: 'Combat Speed Multiplier',
			NUMBER_OF_TEST: 'Number of test fights',
			NUMBER_OF_AUTO_BATTLE: 'Number of auto-battle attempts',
			/* Buttons */
			RUN_SCRIPT: 'Run the',
			TO_DO_EVERYTHING: 'Do All',
			TO_DO_EVERYTHING_TITLE: 'Perform multiple actions of your choice',
			OUTLAND: 'Outland',
			OUTLAND_TITLE: 'Collect Outland',
			TITAN_ARENA: 'ToE',
			TITAN_ARENA_TITLE: 'Complete the titan arena',
			DUNGEON: 'Dungeon',
			DUNGEON_TITLE: 'Go through the dungeon',
			SEER: 'Seer',
			SEER_TITLE: 'Roll the Seer',
			TOWER: 'Tower',
			TOWER_TITLE: 'Pass the tower',
			ARENA: 'Arena',
			ARENA_TITLE: 'Automatically battle in Arena',
			GRAND_ARENA: 'Grand Arena',
			GRAND_ARENA_TITLE: 'Automatically battle in Grand Arena',
			AUTO_ARENAS: 'Auto Arena & Grand Arena',
			AUTO_ARENAS_TITLE: 'Automatically battle in both Arena and Grand Arena',
			INITIALIZING: 'Initializing',
			ATTEMPTS: 'Attempts',
			BATTLE: 'Battle',
			RANK: 'Rank',
			PEACE_TIME: 'Peace Time',
			DISABLED: 'Disabled',
			NO_BATTLES_AVAILABLE: 'No battles available',
			EXPEDITIONS: 'Expeditions',
			EXPEDITIONS_TITLE: 'Sending and collecting expeditions',
			SYNC: 'Sync',
			SYNC_TITLE: 'Partial synchronization of game data without reloading the page',
			ARCHDEMON: 'Archdemon',
			FURNACE_OF_SOULS: 'Furnace of souls',
			ARCHDEMON_TITLE: 'Hitting kills and collecting rewards',
			ESTER_EGGS: 'Easter eggs',
			ESTER_EGGS_TITLE: 'Collect all Easter eggs or rewards',
			REWARDS: 'Rewards',
			REWARDS_TITLE: 'Collect all quest rewards',
			MAIL: 'Mail',
			MAIL_TITLE: 'Collect all mail, except letters with energy and charges of the portal',
			MINIONS: 'Minions',
			MINIONS_TITLE: 'Attack minions with saved packs',
			ADVENTURE: 'Adv.',
			ADVENTURE_TITLE: 'Passes the adventure along the specified route',
			STORM: 'Storm',
			STORM_TITLE: 'Passes the Storm along the specified route',
			SANCTUARY: 'Sanctuary',
			SANCTUARY_TITLE: 'Fast travel to Sanctuary',
			GUILD_WAR: 'Guild War',
			GUILD_WAR_TITLE: 'Auto attack Guild War slots',
			SECRET_WEALTH: 'Secret Wealth',
			SECRET_WEALTH_TITLE: 'Buy something in the store "Secret Wealth"',
			/* Misc */
			BOTTOM_URLS:
				'<a href="https://t.me/+0oMwICyV1aQ1MDAy" target="_blank" title="Telegram"><svg width="20" height="20" style="margin:2px" viewBox="0 0 1e3 1e3" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="a" x1="50%" x2="50%" y2="99.258%"><stop stop-color="#2AABEE" offset="0"/><stop stop-color="#229ED9" offset="1"/></linearGradient></defs><g fill-rule="evenodd"><circle cx="500" cy="500" r="500" fill="url(#a)"/><path d="m226.33 494.72c145.76-63.505 242.96-105.37 291.59-125.6 138.86-57.755 167.71-67.787 186.51-68.119 4.1362-0.072862 13.384 0.95221 19.375 5.8132 5.0584 4.1045 6.4501 9.6491 7.1161 13.541 0.666 3.8915 1.4953 12.756 0.83608 19.683-7.5246 79.062-40.084 270.92-56.648 359.47-7.0089 37.469-20.81 50.032-34.17 51.262-29.036 2.6719-51.085-19.189-79.207-37.624-44.007-28.847-68.867-46.804-111.58-74.953-49.366-32.531-17.364-50.411 10.769-79.631 7.3626-7.6471 135.3-124.01 137.77-134.57 0.30968-1.3202 0.59708-6.2414-2.3265-8.8399s-7.2385-1.7099-10.352-1.0032c-4.4137 1.0017-74.715 47.468-210.9 139.4-19.955 13.702-38.029 20.379-54.223 20.029-17.853-0.3857-52.194-10.094-77.723-18.393-31.313-10.178-56.199-15.56-54.032-32.846 1.1287-9.0037 13.528-18.212 37.197-27.624z" fill="#fff"/></g></svg></a><a href="https://www.patreon.com/HeroWarsUserScripts" target="_blank" title="Patreon"><svg width="20" height="20" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg"><g fill="#FFF" stroke="None"><path d="m1033 324.45c-0.19-137.9-107.59-250.92-233.6-291.7-156.48-50.64-362.86-43.3-512.28 27.2-181.1 85.46-237.99 272.66-240.11 459.36-1.74 153.5 13.58 557.79 241.62 560.67 169.44 2.15 194.67-216.18 273.07-321.33 55.78-74.81 127.6-95.94 216.01-117.82 151.95-37.61 255.51-157.53 255.29-316.38z"/></g></svg></a>',
			GIFTS_SENT: 'Gifts sent!',
			DO_YOU_WANT: 'Do you really want to do this?',
			BTN_RUN: 'Run',
			BTN_CANCEL: 'Cancel',
			BTN_ACCEPT: 'Accept',
			BTN_OK: 'OK',
			MSG_HAVE_BEEN_DEFEATED: 'You have been defeated!',
			BTN_AUTO: 'Auto',
			MSG_YOU_APPLIED: 'You applied',
			MSG_DAMAGE: 'damage',
			MSG_CANCEL_AND_STAT: 'Auto (F5) and show statistic',
			MSG_REPEAT_MISSION: 'Repeat the mission?',
			BTN_REPEAT: 'Repeat',
			BTN_NO: 'No',
			MSG_SPECIFY_QUANT: 'Specify Quantity:',
			BTN_OPEN: 'Open',
			QUESTION_COPY: 'Question copied to clipboard',
			ANSWER_KNOWN: 'The answer is known',
			ANSWER_NOT_KNOWN: 'ATTENTION THE ANSWER IS NOT KNOWN',
			BEING_RECALC: 'The battle is being recalculated',
			THIS_TIME: 'This time',
			VICTORY: '<span style="color:green;">VICTORY</span>',
			DEFEAT: '<span style="color:red;">DEFEAT</span>',
			CHANCE_TO_WIN: 'Chance to win <span style="color: red;">based on pre-calculation</span>',
			OPEN_DOLLS: 'nesting dolls recursively',
			SENT_QUESTION: 'Question sent',
			SETTINGS: 'Settings',
			MSG_BAN_ATTENTION: '<p style="color:red;">Using this feature may result in a ban.</p> Continue?',
			BTN_YES_I_AGREE: 'Yes, I understand the risks!',
			BTN_NO_I_AM_AGAINST: 'No, I refuse it!',
			VALUES: 'Values',
			EXPEDITIONS_SENT: 'Expeditions:<br>Collected: {countGet}<br>Sent: {countSend}',
			EXPEDITIONS_NOTHING: 'Nothing to collect/send',
			EXPEDITIONS_NOTTIME: 'It is not time for expeditions',
			TITANIT: 'Titanit',
			COMPLETED: 'completed',
			FLOOR: 'Floor',
			LEVEL: 'Level',
			BATTLES: 'battles',
			EVENT: 'Event',
			NOT_AVAILABLE: 'not available',
			NO_HEROES: 'No heroes',
			DAMAGE_AMOUNT: 'Damage amount',
			NOTHING_TO_COLLECT: 'Nothing to collect',
			COLLECTED: 'Collected',
			REWARD: 'rewards',
			REMAINING_ATTEMPTS: 'Remaining attempts',
			BATTLES_CANCELED: 'Battles canceled',
			MINION_RAID: 'Minion Raid',
			STOPPED: 'Stopped',
			REPETITIONS: 'Repetitions',
			MISSIONS_PASSED: 'Missions passed',
			STOP: 'stop',
			TOTAL_OPEN: 'Total open',
			OPEN: 'Open',
			ROUND_STAT: 'Damage statistics for ',
			BATTLE: 'battles',
			MINIMUM: 'Minimum',
			MAXIMUM: 'Maximum',
			AVERAGE: 'Average',
			NOT_THIS_TIME: 'Not this time',
			RETRY_LIMIT_EXCEEDED: 'Retry limit exceeded',
			SUCCESS: 'Success',
			RECEIVED: 'Received',
			LETTERS: 'letters',
			PORTALS: 'portals',
			ATTEMPTS: 'attempts',
			/* Quests */
			QUEST_10001: 'Upgrade the skills of heroes 3 times',
			QUEST_10002: 'Complete 10 missions',
			QUEST_10003: 'Complete 3 heroic missions',
			QUEST_10004: 'Fight 3 times in the Arena or Grand Arena',
			QUEST_10006: 'Use the exchange of emeralds 1 time',
			QUEST_10007: 'Perform 1 summon in the Soul Atrium',
			QUEST_10016: 'Send gifts to guildmates',
			QUEST_10018: 'Use an experience potion',
			QUEST_10019: 'Open 1 chest in the Tower',
			QUEST_10020: 'Open 3 chests in Outland',
			QUEST_10021: 'Collect 75 Titanite in the Guild Dungeon',
			QUEST_10021: 'Collect 150 Titanite in the Guild Dungeon',
			QUEST_10023: 'Upgrade Gift of the Elements by 1 level',
			QUEST_10024: 'Level up any artifact once',
			QUEST_10025: 'Start Expedition 1',
			QUEST_10026: 'Start 4 Expeditions',
			QUEST_10027: 'Win 1 battle of the Tournament of Elements',
			QUEST_10028: 'Level up any titan artifact',
			QUEST_10029: 'Unlock the Orb of Titan Artifacts',
			QUEST_10030: 'Upgrade any Skin of any hero 1 time',
			QUEST_10031: 'Win 6 battles of the Tournament of Elements',
			QUEST_10043: 'Start or Join an Adventure',
			QUEST_10044: 'Use Summon Pets 1 time',
			QUEST_10046: 'Open 3 chests in Adventure',
			QUEST_10047: 'Get 150 Guild Activity Points',
			NOTHING_TO_DO: 'Nothing to do',
			YOU_CAN_COMPLETE: 'You can complete quests',
			BTN_DO_IT: 'Do it',
			NOT_QUEST_COMPLETED: 'Not a single quest completed',
			COMPLETED_QUESTS: 'Completed quests',
			/* everything button */
			ASSEMBLE_OUTLAND: 'Assemble Outland',
			PASS_THE_TOWER: 'Pass the tower',
			CHECK_EXPEDITIONS: 'Check Expeditions',
			COMPLETE_TOE: 'Complete ToE',
			COMPLETE_DUNGEON: 'Complete the dungeon',
			COLLECT_MAIL: 'Collect mail',
			COLLECT_MISC: 'Collect some bullshit',
			COLLECT_MISC_TITLE: 'Collect Easter Eggs, Skin Gems, Keys, Arena Coins and Soul Crystal',
			COLLECT_QUEST_REWARDS: 'Collect quest rewards',
			MAKE_A_SYNC: 'Make a sync',

			RUN_FUNCTION: 'Run the following functions?',
			BTN_GO: 'Go!',
			PERFORMED: 'Performed',
			DONE: 'Done',
			ERRORS_OCCURRES: 'Errors occurred while executing',
			COPY_ERROR: 'Copy error information to clipboard',
			BTN_YES: 'Yes',
			ALL_TASK_COMPLETED: 'All tasks completed',

			UNKNOWN: 'unknown',
			ENTER_THE_PATH: 'Enter the path of adventure using commas or dashes',
			START_ADVENTURE: 'Start your adventure along this path!',
			INCORRECT_WAY: 'Incorrect path in adventure: {from} -> {to}',
			BTN_CANCELED: 'Canceled',
			MUST_TWO_POINTS: 'The path must contain at least 2 points.',
			MUST_ONLY_NUMBERS: 'The path must contain only numbers and commas',
			NOT_ON_AN_ADVENTURE: 'You are not on an adventure',
			YOU_IN_NOT_ON_THE_WAY: 'Your location is not on the way',
			ATTEMPTS_NOT_ENOUGH: 'Your attempts are not enough to complete the path, continue?',
			YES_CONTINUE: 'Yes, continue!',
			NOT_ENOUGH_AP: 'Not enough action points',
			ATTEMPTS_ARE_OVER: 'The attempts are over',
			MOVES: 'Moves',
			BUFF_GET_ERROR: 'Buff getting error',
			BATTLE_END_ERROR: 'Battle end error',
			AUTOBOT: 'Autobot',
			FAILED_TO_WIN_AUTO: 'Failed to win the auto battle',
			ERROR_OF_THE_BATTLE_COPY: 'An error occurred during the passage of the battle<br>Copy the error to the clipboard?',
			ERROR_DURING_THE_BATTLE: 'Error during the battle',
			NO_CHANCE_WIN: 'No chance of winning this fight: 0/',
			LOST_HEROES: 'You have won, but you have lost one or several heroes',
			VICTORY_IMPOSSIBLE: 'Is victory impossible, should we focus on the result?',
			FIND_COEFF: 'Find the coefficient greater than',
			BTN_PASS: 'PASS',
			BRAWLS: 'Brawls',
			BRAWLS_TITLE: 'Activates the ability to auto-brawl',
			START_AUTO_BRAWLS: 'Start Auto Brawls?',
			LOSSES: 'Losses',
			WINS: 'Wins',
			FIGHTS: 'Fights',
			STAGE: 'Stage',
			DONT_HAVE_LIVES: "You don't have lives",
			LIVES: 'Lives',
			SECRET_WEALTH_ALREADY: 'Item for Pet Potions already purchased',
			SECRET_WEALTH_NOT_ENOUGH: 'Not Enough Pet Potion, You Have {available}, Need {need}',
			SECRET_WEALTH_UPGRADE_NEW_PET: 'After purchasing the Pet Potion, it will not be enough to upgrade a new pet',
			SECRET_WEALTH_PURCHASED: 'Purchased {count} {name}',
			SECRET_WEALTH_CANCELED: 'Secret Wealth: Purchase Canceled',
			SECRET_WEALTH_BUY: 'You have {available} Pet Potion.<br>Do you want to buy {countBuy} {name} for {price} Pet Potion?',
			DAILY_BONUS: 'Daily bonus',
			DO_DAILY_QUESTS: 'Do daily quests',
			ACTIONS: 'Actions',
			ACTIONS_TITLE: 'Dialog box with various actions',
			OTHERS: 'Others',
			OTHERS_TITLE: 'Others',
			CHOOSE_ACTION: 'Choose an action',
			OPEN_LOOTBOX: 'You have {lootBox} boxes, should we open them?',
			STAMINA: 'Energy',
			BOXES_OVER: 'The boxes are over',
			NO_BOXES: 'No boxes',
			NO_MORE_ACTIVITY: 'No more activity for items today',
			EXCHANGE_ITEMS: 'Exchange items for activity points (max {maxActive})?',
			GET_ACTIVITY: 'Get Activity',
			NOT_ENOUGH_ITEMS: 'Not enough items',
			ACTIVITY_RECEIVED: 'Activity received',
			NO_PURCHASABLE_HERO_SOULS: 'No purchasable Hero Souls',
			PURCHASED_HERO_SOULS: 'Purchased {countHeroSouls} Hero Souls',
			NOT_ENOUGH_EMERALDS_540: 'Not enough emeralds, you need {imgEmerald}540 you have {imgEmerald}{currentStarMoney}',
			BUY_OUTLAND_BTN: 'Buy {count} chests {imgEmerald}{countEmerald}',
			CHESTS_NOT_AVAILABLE: 'Chests not available',
			OUTLAND_CHESTS_RECEIVED: 'Outland chests received',
			RAID_NOT_AVAILABLE: 'The raid is not available or there are no spheres',
			RAID_ADVENTURE: 'Raid {adventureId} adventure!',
			SOMETHING_WENT_WRONG: 'Something went wrong',
			ADVENTURE_COMPLETED: 'Adventure {adventureId} completed {times} times',
			CLAN_STAT_COPY: 'Clan statistics copied to clipboard',
			GET_ENERGY: 'Get Energy',
			GET_ENERGY_TITLE: 'Opens platinum boxes one at a time until you get 250 energy',
			ITEM_EXCHANGE: 'Item Exchange',
			ITEM_EXCHANGE_TITLE: 'Exchanges items for the specified amount of activity',
			BUY_SOULS: 'Buy souls',
			BUY_SOULS_TITLE: 'Buy hero souls from all available shops',
			BUY_OUTLAND: 'Buy Outland',
			BUY_OUTLAND_TITLE: 'Buy 9 chests in Outland for 540 emeralds',
			RAID: 'Raid',
			AUTO_RAID_ADVENTURE: 'Raid',
			AUTO_RAID_ADVENTURE_TITLE: 'Raid adventure set number of times',
			CLAN_STAT: 'Clan statistics',
			CLAN_STAT_TITLE: 'Copies clan statistics to the clipboard',
			BTN_AUTO_F5: 'Auto (F5)',
			BOSS_DAMAGE: 'Boss Damage: ',
			NOTHING_BUY: 'Nothing to buy',
			LOTS_BOUGHT: '{countBuy} lots bought for gold',
			BUY_FOR_GOLD: 'Buy for gold',
			BUY_FOR_GOLD_TITLE: 'Buy items for gold in the Town Shop and in the Pet Soul Stone Shop',
			REWARDS_AND_MAIL: 'Rewards and Mail',
			REWARDS_AND_MAIL_TITLE: 'Collects rewards and mail',
			COLLECT_REWARDS_AND_MAIL: 'Collected {countQuests} rewards and {countMail} letters',
			TIMER_ALREADY: 'Timer already started {time}',
			NO_ATTEMPTS_TIMER_START: 'No attempts, timer started {time}',
			EPIC_BRAWL_RESULT: 'Wins: {wins}/{attempts}, Coins: {coins}, Streak: {progress}/{nextStage} [Close]{end}',
			ATTEMPT_ENDED: '<br>Attempts ended, timer started {time}',
			EPIC_BRAWL: 'Cosmic Battle',
			EPIC_BRAWL_TITLE: 'Spends attempts in the Cosmic Battle',
			RELOAD_GAME: 'Reload game',
			TIMER: 'Timer:',
			SHOW_ERRORS: 'Show errors',
			SHOW_ERRORS_TITLE: 'Show server request errors',
			ERROR_MSG: 'Error: {name}<br>{description}',
			EVENT_AUTO_BOSS:
				'Maximum number of battles for calculation:</br>{length} ∗ {countTestBattle} = {maxCalcBattle}</br>If you have a weak computer, it may take a long time for this, click on the cross to cancel.</br>Should I search for the best pack from all or the first suitable one?',
			BEST_SLOW: 'Best (slower)',
			FIRST_FAST: 'First (faster)',
			FREEZE_INTERFACE: 'Calculating... <br>The interface may freeze.',
			ERROR_F12: 'Error, details in the console (F12)',
			FAILED_FIND_WIN_PACK: 'Failed to find a winning pack',
			BEST_PACK: 'Best pack:',
			BOSS_HAS_BEEN_DEF: 'Boss {bossLvl} has been defeated.',
			NOT_ENOUGH_ATTEMPTS_BOSS: 'Not enough attempts to defeat boss {bossLvl}, retry?',
			BOSS_VICTORY_IMPOSSIBLE:
				'Based on the recalculation of {battles} battles, victory has not been achieved. Would you like to continue the search for a winning battle in real battles?',
			BOSS_HAS_BEEN_DEF_TEXT:
				'Boss {bossLvl} defeated in<br>{countBattle}/{countMaxBattle} attempts{winTimer}<br>(Please synchronize or restart the game to update the data)',
			MAP: 'Map: ',
			PLAYER_POS: 'Player positions:',
			NY_GIFTS: 'Gifts',
			NY_GIFTS_TITLE: "Open all New Year's gifts",
			NY_NO_GIFTS: 'No gifts not received',
			NY_GIFTS_COLLECTED: '{count} gifts collected',
			CHANGE_MAP: 'Island map',
			CHANGE_MAP_TITLE: 'Change island map',
			SELECT_ISLAND_MAP: 'Select an island map:',
			MAP_NUM: 'Map {num}',
			SECRET_WEALTH_SHOP: 'Secret Wealth {name}: ',
			SHOPS: 'Shops',
			SHOPS_DEFAULT: 'Default',
			SHOPS_DEFAULT_TITLE: 'Default stores',
			SHOPS_LIST: 'Shops {number}',
			SHOPS_LIST_TITLE: 'List of shops {number}',
			SHOPS_WARNING:
				'Stores<br><span style="color:red">If you buy brawl store coins for emeralds, you must use them immediately, otherwise they will disappear after restarting the game!</span>',
			MINIONS_WARNING: 'The hero packs for attacking minions are incomplete, should I continue?',
			MONDAY_AUTO_RUN: 'Monday auto-run',
			MONDAY_AUTO_RUN_TITLE: 'Automatically run minions attack every Monday',
			MONDAY_DETECTED: 'Monday detected - Auto-running minions attack...',
			MONDAY_NOT_TODAY: 'Today is {day} - Minions auto-run only on Mondays',
			MONDAY_COMPLETED: 'Minions attack completed (Monday auto-run)',
			MONDAY_FAILED: 'Minions attack failed (Monday auto-run)',
			FAST_SEASON: 'Fast season',
			FAST_SEASON_TITLE: 'Skip the map selection screen in a season',
			AUTO_RAID_MISSION: 'Auto Raid Mission',
			AUTO_RAID_MISSION_TITLE: 'Automatically execute raid missions on script load',
			NOT_ENOUGH_ENERGY: 'Not enough energy for raid missions',
			NO_RAID_MISSIONS_AVAILABLE: 'No raid missions available',
			STARTING_RAID_MISSIONS: 'Starting raid missions: Mission {missionId} x{count}',
			RAID_MISSIONS_COMPLETED: 'Raid missions completed: Mission {missionId} x{count} - Gold: {gold}, Fragments: {fragments}',
			RAID_MISSIONS_FAILED: 'Raid missions failed',
			RAID_MISSIONS_ERROR: 'Error during raid missions',
			SET_NUMBER_LEVELS: 'Specify the number of levels:',
			POSSIBLE_IMPROVE_LEVELS: 'It is possible to improve only {count} levels.<br>Improving?',
			NOT_ENOUGH_RESOURECES: 'Not enough resources',
			IMPROVED_LEVELS: 'Improved levels: {count}',
			ARTIFACTS_UPGRADE: 'Artifacts Upgrade',
			ARTIFACTS_UPGRADE_TITLE: 'Upgrades the specified amount of the cheapest hero artifacts',
			SKINS_UPGRADE: 'Skins Upgrade',
			SKINS_UPGRADE_TITLE: 'Upgrades the specified amount of the cheapest hero skins',
			HINT: '<br>Hint: ',
			PICTURE: '<br>Picture: ',
			ANSWER: '<br>Answer: ',
			NO_HEROES_PACK: 'Fight at least one battle to save the attacking team',
			BRAWL_AUTO_PACK: 'Automatic selection of packs',
			BRAWL_AUTO_PACK_NOT_CUR_HERO: 'Automatic pack selection is not suitable for the current hero',
			BRAWL_DAILY_TASK_COMPLETED: 'Daily task completed, continue attacking?',
			CALC_STAT: 'Calculate statistics',
			ELEMENT_TOURNAMENT_REWARD: 'Unclaimed bonus for Elemental Tournament',
			BTN_TRY_FIX_IT: 'Fix it',
			BTN_TRY_FIX_IT_TITLE: 'Enable auto attack combat correction',
			DAMAGE_FIXED: 'Damage fixed from {lastDamage} to {maxDamage}!',
			DAMAGE_NO_FIXED: 'Failed to fix damage: {lastDamage}',
			LETS_FIX: "Let's fix",
			COUNT_FIXED: 'For {count} attempts',
			DEFEAT_TURN_TIMER: 'Defeat! Turn on the timer to complete the mission?',
			SEASON_REWARD: 'Season Rewards',
			SEASON_REWARD_TITLE: 'Collects available free rewards from all current seasons',
			SEASON_REWARD_COLLECTED: 'Collected {count} season rewards',
			SELL_HERO_SOULS: 'Sell ​​souls',
			SELL_HERO_SOULS_TITLE: 'Exchanges all absolute star hero souls for gold',
			GOLD_RECEIVED: 'Gold received: {gold}',
			OPEN_ALL_EQUIP_BOXES: 'Open all Equipment Fragment Box?',
			SERVER_NOT_ACCEPT: 'The server did not accept the result',
			INVASION_BOSS_BUFF: 'For {bossLvl} boss need buff {needBuff} you have {haveBuff}',
			HERO_POWER: 'Hero Power',
			HERO_POWER_TITLE: 'Displays the current and maximum power of heroes',
			MAX_POWER_REACHED: 'Maximum power reached: {power}',
			CURRENT_POWER: 'Current power: {power}',
			POWER_TO_MAX: 'Power left to reach maximum: <span style="color:{color};">{power}</span><br>',
			BEST_RESULT: 'Best result: {value}%',
			GUILD_ISLAND_TITLE: 'Fast travel to Guild Island',
			TITAN_VALLEY_TITLE: 'Fast travel to Titan Valley',
		},
		ru: {
			/* Чекбоксы */
			SKIP_FIGHTS: 'Пропуск боев',
			SKIP_FIGHTS_TITLE: 'Пропуск боев в запределье и арене титанов, автопропуск в башне и кампании',
			ENDLESS_CARDS: 'Бесконечные карты',
			ENDLESS_CARDS_TITLE: 'Отключить трату карт предсказаний',
			AUTO_EXPEDITION: 'АвтоЭкспедиции',
			AUTO_EXPEDITION_TITLE: 'Автоотправка экспедиций',
			CANCEL_FIGHT: 'Отмена боя',
			CANCEL_FIGHT_TITLE: 'Возможность отмены ручного боя на ВГ, СМ и в Асгарде',
			GIFTS: 'Подарки',
			GIFTS_TITLE: 'Собирать подарки автоматически',
			BATTLE_RECALCULATION: 'Прерасчет боя',
			BATTLE_RECALCULATION_TITLE: 'Предварительный расчет боя',
			QUANTITY_CONTROL: 'Контроль кол-ва',
			QUANTITY_CONTROL_TITLE: 'Возможность указывать количество открываемых "лутбоксов"',
			REPEAT_CAMPAIGN: 'Повтор в кампании',
			REPEAT_CAMPAIGN_TITLE: 'Автоповтор боев в кампании',
			DISABLE_DONAT: 'Отключить донат',
			DISABLE_DONAT_TITLE: 'Убирает все предложения доната',
			DAILY_QUESTS: 'Квесты',
			DAILY_QUESTS_TITLE: 'Выполнять ежедневные квесты',
			AUTO_QUIZ: 'АвтоВикторина',
			AUTO_QUIZ_TITLE: 'Автоматическое получение правильных ответов на вопросы викторины',
			SECRET_WEALTH_CHECKBOX: 'Автоматическая покупка в магазине "Тайное Богатство" при заходе в игру',
			HIDE_SERVERS: 'Свернуть сервера',
			HIDE_SERVERS_TITLE: 'Скрывать неиспользуемые сервера',
			/* Поля ввода */
			HOW_MUCH_TITANITE: 'Сколько фармим титанита',
			COMBAT_SPEED: 'Множитель ускорения боя',
			NUMBER_OF_TEST: 'Количество тестовых боев',
			NUMBER_OF_AUTO_BATTLE: 'Количество попыток автобоев',
			/* Кнопки */
			RUN_SCRIPT: 'Запустить скрипт',
			TO_DO_EVERYTHING: 'Сделать все',
			TO_DO_EVERYTHING_TITLE: 'Выполнить несколько действий',
			OUTLAND: 'Запределье',
			OUTLAND_TITLE: 'Собрать Запределье',
			TITAN_ARENA: 'Турн.Стихий',
			TITAN_ARENA_TITLE: 'Автопрохождение Турнира Стихий',
			DUNGEON: 'Подземелье',
			DUNGEON_TITLE: 'Автопрохождение подземелья',
			SEER: 'Провидец',
			SEER_TITLE: 'Покрутить Провидца',
			TOWER: 'Башня',
			TOWER_TITLE: 'Автопрохождение башни',
			ARENA: 'Арена',
			ARENA_TITLE: 'Автоматические бои в Арене',
			GRAND_ARENA: 'Великая Арена',
			GRAND_ARENA_TITLE: 'Автоматические бои в Великой Арене',
			AUTO_ARENAS: 'Авто Арена и Великая Арена',
			AUTO_ARENAS_TITLE: 'Автоматические бои в обеих аренах',
			INITIALIZING: 'Инициализация',
			ATTEMPTS: 'Попытки',
			BATTLE: 'Бой',
			RANK: 'Ранг',
			PEACE_TIME: 'Время мира',
			DISABLED: 'Отключено',
			NO_BATTLES_AVAILABLE: 'Бои недоступны',
			EXPEDITIONS: 'Экспедиции',
			EXPEDITIONS_TITLE: 'Отправка и сбор экспедиций',
			SYNC: 'Синхронизация',
			SYNC_TITLE: 'Частичная синхронизация данных игры без перезагрузки сатраницы',
			ARCHDEMON: 'Архидемон',
			FURNACE_OF_SOULS: 'Горнило душ',
			ARCHDEMON_TITLE: 'Набивает килы и собирает награду',
			ESTER_EGGS: 'Пасхалки',
			ESTER_EGGS_TITLE: 'Собрать все пасхалки или награды',
			REWARDS: 'Награды',
			REWARDS_TITLE: 'Собрать все награды за задания',
			MAIL: 'Почта',
			MAIL_TITLE: 'Собрать всю почту, кроме писем с энергией и зарядами портала',
			MINIONS: 'Прислужники',
			MINIONS_TITLE: 'Атакует прислужников сохраннеными пачками',
			ADVENTURE: 'Прикл',
			ADVENTURE_TITLE: 'Проходит приключение по указанному маршруту',
			STORM: 'Буря',
			STORM_TITLE: 'Проходит бурю по указанному маршруту',
			SANCTUARY: 'Святилище',
			SANCTUARY_TITLE: 'Быстрый переход к Святилищу',
			GUILD_WAR: 'Война гильдий',
			GUILD_WAR_TITLE: 'Автоматическая атака слотов Войны гильдий',
			SECRET_WEALTH: 'Тайное богатство',
			SECRET_WEALTH_TITLE: 'Купить что-то в магазине "Тайное богатство"',
			/* Разное */
			BOTTOM_URLS:
				'<a href="https://t.me/+q6gAGCRpwyFkNTYy" target="_blank" title="Telegram"><svg width="20" height="20" style="margin:2px" viewBox="0 0 1e3 1e3" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="a" x1="50%" x2="50%" y2="99.258%"><stop stop-color="#2AABEE" offset="0"/><stop stop-color="#229ED9" offset="1"/></linearGradient></defs><g fill-rule="evenodd"><circle cx="500" cy="500" r="500" fill="url(#a)"/><path d="m226.33 494.72c145.76-63.505 242.96-105.37 291.59-125.6 138.86-57.755 167.71-67.787 186.51-68.119 4.1362-0.072862 13.384 0.95221 19.375 5.8132 5.0584 4.1045 6.4501 9.6491 7.1161 13.541 0.666 3.8915 1.4953 12.756 0.83608 19.683-7.5246 79.062-40.084 270.92-56.648 359.47-7.0089 37.469-20.81 50.032-34.17 51.262-29.036 2.6719-51.085-19.189-79.207-37.624-44.007-28.847-68.867-46.804-111.58-74.953-49.366-32.531-17.364-50.411 10.769-79.631 7.3626-7.6471 135.3-124.01 137.77-134.57 0.30968-1.3202 0.59708-6.2414-2.3265-8.8399s-7.2385-1.7099-10.352-1.0032c-4.4137 1.0017-74.715 47.468-210.9 139.4-19.955 13.702-38.029 20.379-54.223 20.029-17.853-0.3857-52.194-10.094-77.723-18.393-31.313-10.178-56.199-15.56-54.032-32.846 1.1287-9.0037 13.528-18.212 37.197-27.624z" fill="#fff"/></g></svg></a><a href="https://vk.com/invite/YNPxKGX" target="_blank" title="Вконтакте"><svg width="20" height="20" style="margin:2px" viewBox="0 0 101 100" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#a)"><path d="M0.5 48C0.5 25.3726 0.5 14.0589 7.52944 7.02944C14.5589 0 25.8726 0 48.5 0H52.5C75.1274 0 86.4411 0 93.4706 7.02944C100.5 14.0589 100.5 25.3726 100.5 48V52C100.5 74.6274 100.5 85.9411 93.4706 92.9706C86.4411 100 75.1274 100 52.5 100H48.5C25.8726 100 14.5589 100 7.52944 92.9706C0.5 85.9411 0.5 74.6274 0.5 52V48Z" fill="#07f"/><path d="m53.708 72.042c-22.792 0-35.792-15.625-36.333-41.625h11.417c0.375 19.083 8.7915 27.167 15.458 28.833v-28.833h10.75v16.458c6.5833-0.7083 13.499-8.2082 15.832-16.458h10.75c-1.7917 10.167-9.2917 17.667-14.625 20.75 5.3333 2.5 13.875 9.0417 17.125 20.875h-11.834c-2.5417-7.9167-8.8745-14.042-17.25-14.875v14.875h-1.2919z" fill="#fff"/></g><defs><clipPath id="a"><rect transform="translate(.5)" width="100" height="100" fill="#fff"/></clipPath></defs></svg></a>',
			GIFTS_SENT: 'Подарки отправлены!',
			DO_YOU_WANT: 'Вы действительно хотите это сделать?',
			BTN_RUN: 'Запускай',
			BTN_CANCEL: 'Отмена',
			BTN_ACCEPT: 'Принять',
			BTN_OK: 'Ок',
			MSG_HAVE_BEEN_DEFEATED: 'Вы потерпели поражение!',
			BTN_AUTO: 'Авто',
			MSG_YOU_APPLIED: 'Вы нанесли',
			MSG_DAMAGE: 'урона',
			MSG_CANCEL_AND_STAT: 'Авто (F5) и показать Статистику',
			MSG_REPEAT_MISSION: 'Повторить миссию?',
			BTN_REPEAT: 'Повторить',
			BTN_NO: 'Нет',
			MSG_SPECIFY_QUANT: 'Указать количество:',
			BTN_OPEN: 'Открыть',
			QUESTION_COPY: 'Вопрос скопирован в буфер обмена',
			ANSWER_KNOWN: 'Ответ известен',
			ANSWER_NOT_KNOWN: 'ВНИМАНИЕ ОТВЕТ НЕ ИЗВЕСТЕН',
			BEING_RECALC: 'Идет прерасчет боя',
			THIS_TIME: 'На этот раз',
			VICTORY: '<span style="color:green;">ПОБЕДА</span>',
			DEFEAT: '<span style="color:red;">ПОРАЖЕНИЕ</span>',
			CHANCE_TO_WIN: 'Шансы на победу <span style="color:red;">на основе прерасчета</span>',
			OPEN_DOLLS: 'матрешек рекурсивно',
			SENT_QUESTION: 'Вопрос отправлен',
			SETTINGS: 'Настройки',
			MSG_BAN_ATTENTION: '<p style="color:red;">Использование этой функции может привести к бану.</p> Продолжить?',
			BTN_YES_I_AGREE: 'Да, я беру на себя все риски!',
			BTN_NO_I_AM_AGAINST: 'Нет, я отказываюсь от этого!',
			VALUES: 'Значения',
			EXPEDITIONS_SENT: 'Экспедиции:<br>Собрано: {countGet}<br>Отправлено: {countSend}',
			EXPEDITIONS_NOTHING: 'Нечего собирать/отправлять',
			EXPEDITIONS_NOTTIME: 'Не время для экспедиций',
			TITANIT: 'Титанит',
			COMPLETED: 'завершено',
			FLOOR: 'Этаж',
			LEVEL: 'Уровень',
			BATTLES: 'бои',
			EVENT: 'Эвент',
			NOT_AVAILABLE: 'недоступен',
			NO_HEROES: 'Нет героев',
			DAMAGE_AMOUNT: 'Количество урона',
			NOTHING_TO_COLLECT: 'Нечего собирать',
			COLLECTED: 'Собрано',
			REWARD: 'наград',
			REMAINING_ATTEMPTS: 'Осталось попыток',
			BATTLES_CANCELED: 'Битв отменено',
			MINION_RAID: 'Рейд прислужников',
			STOPPED: 'Остановлено',
			REPETITIONS: 'Повторений',
			MISSIONS_PASSED: 'Миссий пройдено',
			STOP: 'остановить',
			TOTAL_OPEN: 'Всего открыто',
			OPEN: 'Открыто',
			ROUND_STAT: 'Статистика урона за',
			BATTLE: 'боев',
			MINIMUM: 'Минимальный',
			MAXIMUM: 'Максимальный',
			AVERAGE: 'Средний',
			NOT_THIS_TIME: 'Не в этот раз',
			RETRY_LIMIT_EXCEEDED: 'Превышен лимит попыток',
			SUCCESS: 'Успех',
			RECEIVED: 'Получено',
			LETTERS: 'писем',
			PORTALS: 'порталов',
			ATTEMPTS: 'попыток',
			QUEST_10001: 'Улучши умения героев 3 раза',
			QUEST_10002: 'Пройди 10 миссий',
			QUEST_10003: 'Пройди 3 героические миссии',
			QUEST_10004: 'Сразись 3 раза на Арене или Гранд Арене',
			QUEST_10006: 'Используй обмен изумрудов 1 раз',
			QUEST_10007: 'Соверши 1 призыв в Атриуме Душ',
			QUEST_10016: 'Отправь подарки согильдийцам',
			QUEST_10018: 'Используй зелье опыта',
			QUEST_10019: 'Открой 1 сундук в Башне',
			QUEST_10020: 'Открой 3 сундука в Запределье',
			QUEST_10021: 'Собери 75 Титанита в Подземелье Гильдии',
			QUEST_10021: 'Собери 150 Титанита в Подземелье Гильдии',
			QUEST_10023: 'Прокачай Дар Стихий на 1 уровень',
			QUEST_10024: 'Повысь уровень любого артефакта один раз',
			QUEST_10025: 'Начни 1 Экспедицию',
			QUEST_10026: 'Начни 4 Экспедиции',
			QUEST_10027: 'Победи в 1 бою Турнира Стихий',
			QUEST_10028: 'Повысь уровень любого артефакта титанов',
			QUEST_10029: 'Открой сферу артефактов титанов',
			QUEST_10030: 'Улучши облик любого героя 1 раз',
			QUEST_10031: 'Победи в 6 боях Турнира Стихий',
			QUEST_10043: 'Начни или присоеденись к Приключению',
			QUEST_10044: 'Воспользуйся призывом питомцев 1 раз',
			QUEST_10046: 'Открой 3 сундука в Приключениях',
			QUEST_10047: 'Набери 150 очков активности в Гильдии',
			NOTHING_TO_DO: 'Нечего выполнять',
			YOU_CAN_COMPLETE: 'Можно выполнить квесты',
			BTN_DO_IT: 'Выполняй',
			NOT_QUEST_COMPLETED: 'Ни одного квеста не выполенно',
			COMPLETED_QUESTS: 'Выполнено квестов',
			/* everything button */
			ASSEMBLE_OUTLAND: 'Собрать Запределье',
			PASS_THE_TOWER: 'Пройти башню',
			CHECK_EXPEDITIONS: 'Проверить экспедиции',
			COMPLETE_TOE: 'Пройти Турнир Стихий',
			COMPLETE_DUNGEON: 'Пройти подземелье',
			COLLECT_MAIL: 'Собрать почту',
			COLLECT_MISC: 'Собрать всякую херню',
			COLLECT_MISC_TITLE: 'Собрать пасхалки, камни облика, ключи, монеты арены и Хрусталь души',
			COLLECT_QUEST_REWARDS: 'Собрать награды за квесты',
			MAKE_A_SYNC: 'Сделать синхронизацию',

			RUN_FUNCTION: 'Выполнить следующие функции?',
			BTN_GO: 'Погнали!',
			PERFORMED: 'Выполняется',
			DONE: 'Выполнено',
			ERRORS_OCCURRES: 'Призошли ошибки при выполнении',
			COPY_ERROR: 'Скопировать в буфер информацию об ошибке',
			BTN_YES: 'Да',
			ALL_TASK_COMPLETED: 'Все задачи выполнены',

			UNKNOWN: 'Неизвестно',
			ENTER_THE_PATH: 'Введите путь приключения через запятые или дефисы',
			START_ADVENTURE: 'Начать приключение по этому пути!',
			INCORRECT_WAY: 'Неверный путь в приключении: {from} -> {to}',
			BTN_CANCELED: 'Отменено',
			MUST_TWO_POINTS: 'Путь должен состоять минимум из 2х точек',
			MUST_ONLY_NUMBERS: 'Путь должен содержать только цифры и запятые',
			NOT_ON_AN_ADVENTURE: 'Вы не в приключении',
			YOU_IN_NOT_ON_THE_WAY: 'Указанный путь должен включать точку вашего положения',
			ATTEMPTS_NOT_ENOUGH: 'Ваших попыток не достаточно для завершения пути, продолжить?',
			YES_CONTINUE: 'Да, продолжай!',
			NOT_ENOUGH_AP: 'Попыток не достаточно',
			ATTEMPTS_ARE_OVER: 'Попытки закончились',
			MOVES: 'Ходы',
			BUFF_GET_ERROR: 'Ошибка при получении бафа',
			BATTLE_END_ERROR: 'Ошибка завершения боя',
			AUTOBOT: 'АвтоБой',
			FAILED_TO_WIN_AUTO: 'Не удалось победить в автобою',
			ERROR_OF_THE_BATTLE_COPY: 'Призошли ошибка в процессе прохождения боя<br>Скопировать ошибку в буфер обмена?',
			ERROR_DURING_THE_BATTLE: 'Ошибка в процессе прохождения боя',
			NO_CHANCE_WIN: 'Нет шансов победить в этом бою: 0/',
			LOST_HEROES: 'Вы победили, но потеряли одного или несколько героев!',
			VICTORY_IMPOSSIBLE: 'Победа не возможна, бъем на результат?',
			FIND_COEFF: 'Поиск коэффициента больше чем',
			BTN_PASS: 'ПРОПУСК',
			BRAWLS: 'Потасовки',
			BRAWLS_TITLE: 'Включает возможность автопотасовок',
			START_AUTO_BRAWLS: 'Запустить Автопотасовки?',
			LOSSES: 'Поражений',
			WINS: 'Побед',
			FIGHTS: 'Боев',
			STAGE: 'Стадия',
			DONT_HAVE_LIVES: 'У Вас нет жизней',
			LIVES: 'Жизни',
			SECRET_WEALTH_ALREADY: 'товар за Зелья питомцев уже куплен',
			SECRET_WEALTH_NOT_ENOUGH: 'Не достаточно Зелье Питомца, у Вас {available}, нужно {need}',
			SECRET_WEALTH_UPGRADE_NEW_PET: 'После покупки Зелье Питомца будет не достаточно для прокачки нового питомца',
			SECRET_WEALTH_PURCHASED: 'Куплено {count} {name}',
			SECRET_WEALTH_CANCELED: 'Тайное богатство: покупка отменена',
			SECRET_WEALTH_BUY: 'У вас {available} Зелье Питомца.<br>Вы хотите купить {countBuy} {name} за {price} Зелье Питомца?',
			DAILY_BONUS: 'Ежедневная награда',
			DO_DAILY_QUESTS: 'Сделать ежедневные квесты',
			ACTIONS: 'Действия',
			ACTIONS_TITLE: 'Диалоговое окно с различными действиями',
			OTHERS: 'Разное',
			OTHERS_TITLE: 'Диалоговое окно с дополнительными различными действиями',
			CHOOSE_ACTION: 'Выберите действие',
			OPEN_LOOTBOX: 'У Вас {lootBox} ящиков, откываем?',
			STAMINA: 'Энергия',
			BOXES_OVER: 'Ящики закончились',
			NO_BOXES: 'Нет ящиков',
			NO_MORE_ACTIVITY: 'Больше активности за предметы сегодня не получить',
			EXCHANGE_ITEMS: 'Обменять предметы на очки активности (не более {maxActive})?',
			GET_ACTIVITY: 'Получить активность',
			NOT_ENOUGH_ITEMS: 'Предметов недостаточно',
			ACTIVITY_RECEIVED: 'Получено активности',
			NO_PURCHASABLE_HERO_SOULS: 'Нет доступных для покупки душ героев',
			PURCHASED_HERO_SOULS: 'Куплено {countHeroSouls} душ героев',
			NOT_ENOUGH_EMERALDS_540: 'Недостаточно изюма, нужно {imgEmerald}540 у Вас {imgEmerald}{currentStarMoney}',
			BUY_OUTLAND_BTN: 'Купить {count} сундуков {imgEmerald}{countEmerald}',
			CHESTS_NOT_AVAILABLE: 'Сундуки не доступны',
			OUTLAND_CHESTS_RECEIVED: 'Получено сундуков Запределья',
			RAID_NOT_AVAILABLE: 'Рейд не доступен или сфер нет',
			RAID_ADVENTURE: 'Рейд {adventureId} приключения!',
			SOMETHING_WENT_WRONG: 'Что-то пошло не так',
			ADVENTURE_COMPLETED: 'Приключение {adventureId} пройдено {times} раз',
			CLAN_STAT_COPY: 'Клановая статистика скопирована в буфер обмена',
			GET_ENERGY: 'Получить энергию',
			GET_ENERGY_TITLE: 'Открывает платиновые шкатулки по одной до получения 250 энергии',
			ITEM_EXCHANGE: 'Обмен предметов',
			ITEM_EXCHANGE_TITLE: 'Обменивает предметы на указанное количество активности',
			BUY_SOULS: 'Купить души',
			BUY_SOULS_TITLE: 'Купить души героев из всех доступных магазинов',
			BUY_OUTLAND: 'Купить Запределье',
			BUY_OUTLAND_TITLE: 'Купить 9 сундуков в Запределье за 540 изумрудов',
			RAID: 'Рейд',
			AUTO_RAID_ADVENTURE: 'Рейд',
			AUTO_RAID_ADVENTURE_TITLE: 'Рейд приключения заданное количество раз',
			CLAN_STAT: 'Клановая статистика',
			CLAN_STAT_TITLE: 'Копирует клановую статистику в буфер обмена',
			BTN_AUTO_F5: 'Авто (F5)',
			BOSS_DAMAGE: 'Урон по боссу: ',
			NOTHING_BUY: 'Нечего покупать',
			LOTS_BOUGHT: 'За золото куплено {countBuy} лотов',
			BUY_FOR_GOLD: 'Скупить за золото',
			BUY_FOR_GOLD_TITLE: 'Скупить предметы за золото в Городской лавке и в магазине Камней Душ Питомцев',
			REWARDS_AND_MAIL: 'Награды и почта',
			REWARDS_AND_MAIL_TITLE: 'Собирает награды и почту',
			COLLECT_REWARDS_AND_MAIL: 'Собрано {countQuests} наград и {countMail} писем',
			TIMER_ALREADY: 'Таймер уже запущен {time}',
			NO_ATTEMPTS_TIMER_START: 'Попыток нет, запущен таймер {time}',
			EPIC_BRAWL_RESULT: '{i} Победы: {wins}/{attempts}, Монеты: {coins}, Серия: {progress}/{nextStage} [Закрыть]{end}',
			ATTEMPT_ENDED: '<br>Попытки закончились, запущен таймер {time}',
			EPIC_BRAWL: 'Вселенская битва',
			EPIC_BRAWL_TITLE: 'Тратит попытки во Вселенской битве',
			RELOAD_GAME: 'Перезагрузить игру',
			TIMER: 'Таймер:',
			SHOW_ERRORS: 'Отображать ошибки',
			SHOW_ERRORS_TITLE: 'Отображать ошибки запросов к серверу',
			ERROR_MSG: 'Ошибка: {name}<br>{description}',
			EVENT_AUTO_BOSS:
				'Максимальное количество боев для расчета:</br>{length} * {countTestBattle} = {maxCalcBattle}</br>Если у Вас слабый компьютер на это может потребоваться много времени, нажмите крестик для отмены.</br>Искать лучший пак из всех или первый подходящий?',
			BEST_SLOW: 'Лучший (медленее)',
			FIRST_FAST: 'Первый (быстрее)',
			FREEZE_INTERFACE: 'Идет расчет... <br> Интерфейс может зависнуть.',
			ERROR_F12: 'Ошибка, подробности в консоли (F12)',
			FAILED_FIND_WIN_PACK: 'Победный пак найти не удалось',
			BEST_PACK: 'Наилучший пак: ',
			BOSS_HAS_BEEN_DEF: 'Босс {bossLvl} побежден',
			NOT_ENOUGH_ATTEMPTS_BOSS: 'Для победы босса ${bossLvl} не хватило попыток, повторить?',
			BOSS_VICTORY_IMPOSSIBLE:
				'По результатам прерасчета {battles} боев победу получить не удалось. Вы хотите продолжить поиск победного боя на реальных боях?',
			BOSS_HAS_BEEN_DEF_TEXT:
				'Босс {bossLvl} побежден за<br>{countBattle}/{countMaxBattle} попыток{winTimer}<br>(Сделайте синхронизацию или перезагрузите игру для обновления данных)',
			MAP: 'Карта: ',
			PLAYER_POS: 'Позиции игроков:',
			NY_GIFTS: 'Подарки',
			NY_GIFTS_TITLE: 'Открыть все новогодние подарки',
			NY_NO_GIFTS: 'Нет не полученных подарков',
			NY_GIFTS_COLLECTED: 'Собрано {count} подарков',
			CHANGE_MAP: 'Карта острова',
			CHANGE_MAP_TITLE: 'Сменить карту острова',
			SELECT_ISLAND_MAP: 'Выберите карту острова:',
			MAP_NUM: 'Карта {num}',
			SECRET_WEALTH_SHOP: 'Тайное богатство {name}: ',
			SHOPS: 'Магазины',
			SHOPS_DEFAULT: 'Стандартные',
			SHOPS_DEFAULT_TITLE: 'Стандартные магазины',
			SHOPS_LIST: 'Магазины {number}',
			SHOPS_LIST_TITLE: 'Список магазинов {number}',
			SHOPS_WARNING:
				'Магазины<br><span style="color:red">Если Вы купите монеты магазинов потасовок за изумруды, то их надо использовать сразу, иначе после перезагрузки игры они пропадут!</span>',
			MINIONS_WARNING: 'Пачки героев для атаки приспешников неполные, продолжить?',
			MONDAY_AUTO_RUN: 'Автозапуск по понедельникам',
			MONDAY_AUTO_RUN_TITLE: 'Автоматически запускать атаку прислужников каждый понедельник',
			MONDAY_DETECTED: 'Обнаружен понедельник - Автозапуск атаки прислужников...',
			MONDAY_NOT_TODAY: 'Сегодня {day} - Автозапуск прислужников только по понедельникам',
			MONDAY_COMPLETED: 'Атака прислужников завершена (автозапуск понедельника)',
			MONDAY_FAILED: 'Атака прислужников не удалась (автозапуск понедельника)',
			FAST_SEASON: 'Быстрый сезон',
			FAST_SEASON_TITLE: 'Пропуск экрана с выбором карты в сезоне',
			AUTO_RAID_MISSION: 'Авто Рейд Миссии',
			AUTO_RAID_MISSION_TITLE: 'Автоматически выполнять рейд миссии при загрузке скрипта',
			NOT_ENOUGH_ENERGY: 'Недостаточно энергии для рейд миссий',
			NO_RAID_MISSIONS_AVAILABLE: 'Нет доступных рейд миссий',
			STARTING_RAID_MISSIONS: 'Запуск рейд миссий: Миссия {missionId} x{count}',
			RAID_MISSIONS_COMPLETED: 'Рейд миссии завершены: Миссия {missionId} x{count} - Золото: {gold}, Фрагменты: {fragments}',
			RAID_MISSIONS_FAILED: 'Рейд миссии не удались',
			RAID_MISSIONS_ERROR: 'Ошибка при выполнении рейд миссий',
			SET_NUMBER_LEVELS: 'Указать колличество уровней:',
			POSSIBLE_IMPROVE_LEVELS: 'Возможно улучшить только {count} уровней.<br>Улучшаем?',
			NOT_ENOUGH_RESOURECES: 'Не хватает ресурсов',
			IMPROVED_LEVELS: 'Улучшено уровней: {count}',
			ARTIFACTS_UPGRADE: 'Улучшение артефактов',
			ARTIFACTS_UPGRADE_TITLE: 'Улучшает указанное количество самых дешевых артефактов героев',
			SKINS_UPGRADE: 'Улучшение обликов',
			SKINS_UPGRADE_TITLE: 'Улучшает указанное количество самых дешевых обликов героев',
			HINT: '<br>Подсказка: ',
			PICTURE: '<br>На картинке: ',
			ANSWER: '<br>Ответ: ',
			NO_HEROES_PACK: 'Проведите хотя бы один бой для сохранения атакующей команды',
			BRAWL_AUTO_PACK: 'Автоподбор пачки',
			BRAWL_AUTO_PACK_NOT_CUR_HERO: 'Автоматический подбор пачки не подходит для текущего героя',
			BRAWL_DAILY_TASK_COMPLETED: 'Ежедневное задание выполнено, продолжить атаку?',
			CALC_STAT: 'Посчитать статистику',
			ELEMENT_TOURNAMENT_REWARD: 'Несобранная награда за Турнир Стихий',
			BTN_TRY_FIX_IT: 'Исправить',
			BTN_TRY_FIX_IT_TITLE: 'Включить исправление боев при автоатаке',
			DAMAGE_FIXED: 'Урон исправлен с {lastDamage} до {maxDamage}!',
			DAMAGE_NO_FIXED: 'Не удалось исправить урон: {lastDamage}',
			LETS_FIX: 'Исправляем',
			COUNT_FIXED: 'За {count} попыток',
			DEFEAT_TURN_TIMER: 'Поражение! Включить таймер для завершения миссии?',
			SEASON_REWARD: 'Награды сезонов',
			SEASON_REWARD_TITLE: 'Собирает доступные бесплатные награды со всех текущих сезонов',
			SEASON_REWARD_COLLECTED: 'Собрано {count} наград сезонов',
			SELL_HERO_SOULS: 'Продать души',
			SELL_HERO_SOULS_TITLE: 'Обменивает все души героев с абсолютной звездой на золото',
			GOLD_RECEIVED: 'Получено золота: {gold}',
			OPEN_ALL_EQUIP_BOXES: 'Открыть все ящики фрагментов экипировки?',
			SERVER_NOT_ACCEPT: 'Сервер не принял результат',
			INVASION_BOSS_BUFF: 'Для {bossLvl} босса нужен баф {needBuff} у вас {haveBuff}',
			HERO_POWER: 'Сила героев',
			HERO_POWER_TITLE: 'Отображает текущую и максимальную силу героев',
			MAX_POWER_REACHED: 'Максимальная достигнутая мощь: {power}',
			CURRENT_POWER: 'Текущая мощь: {power}',
			POWER_TO_MAX: 'До максимума мощи осталось: <span style="color:{color};">{power}</span><br>',
			BEST_RESULT: 'Лучший результат: {value}%',
			GUILD_ISLAND_TITLE: 'Перейти к Острову гильдии',
			TITAN_VALLEY_TITLE: 'Перейти к Долине титанов',
		},
	};

	function getLang() {
		let lang = '';
		if (typeof NXFlashVars !== 'undefined') {
			lang = NXFlashVars.interface_lang
		}
		if (!lang) {
			lang = (navigator.language || navigator.userLanguage).substr(0, 2);
		}
		const { i18nLangData } = HWHData;
		if (i18nLangData[lang]) {
			return lang;
		}
		return 'en';
	}

	this.I18N = function (constant, replace) {
		const { i18nLangData } = HWHData;
		const selectLang = getLang();
		if (constant && constant in i18nLangData[selectLang]) {
			const result = i18nLangData[selectLang][constant];
			if (replace) {
				return result.sprintf(replace);
			}
			return result;
		}
		console.warn('Language constant not found', {constant, replace});
		if (i18nLangData['en'][constant]) {
			const result = i18nLangData[selectLang][constant];
			if (replace) {
				return result.sprintf(replace);
			}
			return result;
		}
		return `% ${constant} %`;
	};

	String.prototype.sprintf = String.prototype.sprintf ||
		function () {
			"use strict";
			var str = this.toString();
			if (arguments.length) {
				var t = typeof arguments[0];
				var key;
				var args = ("string" === t || "number" === t) ?
					Array.prototype.slice.call(arguments)
					: arguments[0];

				for (key in args) {
					str = str.replace(new RegExp("\\{" + key + "\\}", "gi"), args[key]);
				}
			}

			return str;
		};

	/**
	 * Checkboxes
	 *
	 * Чекбоксы
	 */
	const checkboxes = {
		passBattle: {
			get label() { return I18N('SKIP_FIGHTS'); },
			cbox: null,
			get title() { return I18N('SKIP_FIGHTS_TITLE'); },
			default: false,
		},
		sendExpedition: {
			get label() { return I18N('AUTO_EXPEDITION'); },
			cbox: null,
			get title() { return I18N('AUTO_EXPEDITION_TITLE'); },
			default: false,
		},
		cancelBattle: {
			get label() { return I18N('CANCEL_FIGHT'); },
			cbox: null,
			get title() { return I18N('CANCEL_FIGHT_TITLE'); },
			default: false,
		},
		preCalcBattle: {
			get label() { return I18N('BATTLE_RECALCULATION'); },
			cbox: null,
			get title() { return I18N('BATTLE_RECALCULATION_TITLE'); },
			default: false,
		},
		countControl: {
			get label() { return I18N('QUANTITY_CONTROL'); },
			cbox: null,
			get title() { return I18N('QUANTITY_CONTROL_TITLE'); },
			default: true,
		},
		repeatMission: {
			get label() { return I18N('REPEAT_CAMPAIGN'); },
			cbox: null,
			get title() { return I18N('REPEAT_CAMPAIGN_TITLE'); },
			default: false,
		},
		noOfferDonat: {
			get label() { return I18N('DISABLE_DONAT'); },
			cbox: null,
			get title() { return I18N('DISABLE_DONAT_TITLE'); },
			/**
			 * A crutch to get the field before getting the character id
			 *
			 * Костыль чтоб получать поле до получения id персонажа
			 */
			default: (() => {
				$result = false;
				try {
					$result = JSON.parse(localStorage[GM_info.script.name + ':noOfferDonat']);
				} catch (e) {
					$result = false;
				}
				return $result || false;
			})(),
		},
		dailyQuests: {
			get label() { return I18N('DAILY_QUESTS'); },
			cbox: null,
			get title() { return I18N('DAILY_QUESTS_TITLE'); },
			default: false,
		},
		// Потасовки
		autoBrawls: {
			get label() { return I18N('BRAWLS'); },
			cbox: null,
			get title() { return I18N('BRAWLS_TITLE'); },
			default: (() => {
				$result = false;
				try {
					$result = JSON.parse(localStorage[GM_info.script.name + ':autoBrawls']);
				} catch (e) {
					$result = false;
				}
				return $result || false;
			})(),
			hide: false,
		},
		getAnswer: {
			get label() { return I18N('AUTO_QUIZ'); },
			cbox: null,
			get title() { return I18N('AUTO_QUIZ_TITLE'); },
			default: false,
			hide: false,
		},
		tryFixIt_v2: {
			get label() { return I18N('BTN_TRY_FIX_IT'); },
			cbox: null,
			get title() { return I18N('BTN_TRY_FIX_IT_TITLE'); },
			default: false,
			hide: false,
		},
		showErrors: {
			get label() { return I18N('SHOW_ERRORS'); },
			cbox: null,
			get title() { return I18N('SHOW_ERRORS_TITLE'); },
			default: true,
		},
		buyForGold: {
			get label() { return I18N('BUY_FOR_GOLD'); },
			cbox: null,
			get title() { return I18N('BUY_FOR_GOLD_TITLE'); },
			default: false,
		},
		hideServers: {
			get label() { return I18N('HIDE_SERVERS'); },
			cbox: null,
			get title() { return I18N('HIDE_SERVERS_TITLE'); },
			default: false,
		},
		fastSeason: {
			get label() { return I18N('FAST_SEASON'); },
			cbox: null,
			get title() { return I18N('FAST_SEASON_TITLE'); },
			default: false,
		},
		autoRaidMission: {
			get label() { return I18N('AUTO_RAID_MISSION'); },
			cbox: null,
			get title() { return I18N('AUTO_RAID_MISSION_TITLE'); },
			default: true,
		},
	};
	/**
	 * Get checkbox state
	 *
	 * Получить состояние чекбокса
	 */
	function isChecked(checkBox) {
		const { checkboxes } = HWHData;
		if (!(checkBox in checkboxes)) {
			return false;
		}
		return checkboxes[checkBox].cbox?.checked;
	}
	/**
	 * Input fields
	 *
	 * Поля ввода
	 */
	const inputs = {
		countTitanit: {
			input: null,
			get title() { return I18N('HOW_MUCH_TITANITE'); },
			default: 150,
		},
		speedBattle: {
			input: null,
			get title() { return I18N('COMBAT_SPEED'); },
			default: 5,
		},
		countTestBattle: {
			input: null,
			get title() { return I18N('NUMBER_OF_TEST'); },
			default: 10,
		},
		countAutoBattle: {
			input: null,
			get title() { return I18N('NUMBER_OF_AUTO_BATTLE'); },
			default: 10,
		},
		FPS: {
			input: null,
			title: 'FPS',
			default: 60,
		}
	}
	/**
	 * Checks the checkbox
	 *
	 * Поплучить данные поля ввода
	 */
	function getInput(inputName) {
		const { inputs } = HWHData;
		return inputs[inputName]?.input?.value;
	}

	/**
	 * Control FPS
	 *
	 * Контроль FPS
	 */
	let nextAnimationFrame = Date.now();
	const oldRequestAnimationFrame = this.requestAnimationFrame;
	this.requestAnimationFrame = async function (e) {
		const FPS = Number(getInput('FPS')) || -1;
		const now = Date.now();
		const delay = nextAnimationFrame - now;
		nextAnimationFrame = Math.max(now, nextAnimationFrame) + Math.min(1e3 / FPS, 1e3);
		if (delay > 0) {
			await new Promise((e) => setTimeout(e, delay));
		}
		oldRequestAnimationFrame(e);
	};
	/**
	 * List of main menu buttons
	 *
	 * Список кнопочек основного меню
	 */
	const buttons = {
		getOutland: {
			get name() { return I18N('TO_DO_EVERYTHING'); },
			get title() { return I18N('TO_DO_EVERYTHING_TITLE'); },
			onClick: testDoYourBest,
		},
		doActions: {
			get name() { return I18N('ACTIONS'); },
			get title() { return I18N('ACTIONS_TITLE'); },
			onClick: async function () {
				const { actionsPopupButtons } = HWHData;
				actionsPopupButtons.push({ result: false, isClose: true });
				const answer = await popup.confirm(`${I18N('CHOOSE_ACTION')}:`, actionsPopupButtons);
				if (typeof answer === 'function') {
					answer();
				}
			},
		},
		doOthers: {
			get name() { return I18N('OTHERS'); },
			get title() { return I18N('OTHERS_TITLE'); },
			onClick: async function () {
				const { othersPopupButtons } = HWHData;
				othersPopupButtons.push({ result: false, isClose: true });
				const answer = await popup.confirm(`${I18N('CHOOSE_ACTION')}:`, othersPopupButtons);
				if (typeof answer === 'function') {
					answer();
				}
			},
		},
		testTitanArena: {
			isCombine: true,
			combineList: [
				{
					get name() { return I18N('TITAN_ARENA'); },
					get title() { return I18N('TITAN_ARENA_TITLE'); },
					onClick: function () {
						confShow(`${I18N('RUN_SCRIPT')} ${I18N('TITAN_ARENA')}?`, testTitanArena);
					},
				},
				{
					name: '>>',
					onClick: cheats.goTitanValley,
					get title() { return I18N('TITAN_VALLEY_TITLE'); },
					color: 'green',
				},
			],
		},
		testArena: {
			get name() { return I18N('ARENA'); },
			get title() { return I18N('ARENA_TITLE'); },
			onClick: function () {
				confShow(`${I18N('RUN_SCRIPT')} ${I18N('ARENA')}?`, testArena);
			},
		},
		testGrandArena: {
			get name() { return I18N('GRAND_ARENA'); },
			get title() { return I18N('GRAND_ARENA_TITLE'); },
			onClick: function () {
				confShow(`${I18N('RUN_SCRIPT')} ${I18N('GRAND_ARENA')}?`, testGrandArena);
			},
		},
		testGuildWar: {
			get name() { return I18N('GUILD_WAR'); },
			get title() { return I18N('GUILD_WAR_TITLE'); },
			onClick: function () {
				confShow(`${I18N('RUN_SCRIPT')} ${I18N('GUILD_WAR')}?`, testGuildWar);
			},
		},
		testBothArenas: {
			get name() { return I18N('AUTO_ARENAS'); },
			get title() { return I18N('AUTO_ARENAS_TITLE'); },
			onClick: function () {
				confShow(`${I18N('RUN_SCRIPT')} ${I18N('AUTO_ARENAS')}?`, testBothArenas);
			},
		},
		testDungeon: {
			isCombine: true,
			combineList: [
				{
					get name() { return I18N('DUNGEON'); },
					onClick: function () {
						confShow(`${I18N('RUN_SCRIPT')} ${I18N('DUNGEON')}?`, testDungeon);
					},
					get title() { return I18N('DUNGEON_TITLE'); },
				},
				{
					name: '>>',
					onClick: cheats.goClanIsland,
					get title() { return I18N('GUILD_ISLAND_TITLE'); },
					color: 'green',
				},
			],
		},
		testAdventure: {
			isCombine: true,
			combineList: [
				{
					get name() { return I18N('ADVENTURE'); },
					onClick: () => {
						testAdventure();
					},
					get title() { return I18N('ADVENTURE_TITLE'); },
				},
				{
					get name() { return I18N('AUTO_RAID_ADVENTURE'); },
					onClick: autoRaidAdventure,
					get title() { return I18N('AUTO_RAID_ADVENTURE_TITLE'); },
				},
				{
					name: '>>',
					onClick: cheats.goSanctuary,
					get title() { return I18N('SANCTUARY_TITLE'); },
					color: 'green',
				},
			],
		},
		rewardsAndMailFarm: {
			get name() { return I18N('REWARDS_AND_MAIL'); },
			get title() { return I18N('REWARDS_AND_MAIL_TITLE'); },
			onClick: function () {
				confShow(`${I18N('RUN_SCRIPT')} ${I18N('REWARDS_AND_MAIL')}?`, rewardsAndMailFarm);
			},
		},
		goToClanWar: {
			get name() { return I18N('GUILD_WAR'); },
			get title() { return I18N('GUILD_WAR_TITLE'); },
			onClick: cheats.goClanWar,
			dot: true,
		},
		dailyQuests: {
			get name() { return I18N('DAILY_QUESTS'); },
			get title() { return I18N('DAILY_QUESTS_TITLE'); },
			onClick: async function () {
				const quests = new dailyQuests(
					() => {},
					() => {}
				);
				await quests.autoInit(true);
				quests.start();
			},
		},
		newDay: {
			get name() { return I18N('SYNC'); },
			get title() { return I18N('SYNC_TITLE'); },
			onClick: function () {
				confShow(`${I18N('RUN_SCRIPT')} ${I18N('SYNC')}?`, cheats.refreshGame);
			},
		},
		// Архидемон
		bossRatingEventDemon: {
			get name() { return I18N('ARCHDEMON'); },
			get title() { return I18N('ARCHDEMON_TITLE'); },
			onClick: function () {
				confShow(`${I18N('RUN_SCRIPT')} ${I18N('ARCHDEMON')}?`, bossRatingEvent);
			},
			hide: true,
			color: 'red',
		},
		// Горнило душ
		bossRatingEventSouls: {
			get name() { return I18N('FURNACE_OF_SOULS'); },
			get title() { return I18N('ARCHDEMON_TITLE'); },
			onClick: function () {
				confShow(`${I18N('RUN_SCRIPT')} ${I18N('FURNACE_OF_SOULS')}?`, bossRatingEventSouls);
			},
			hide: true,
			color: 'red',
		},
	};
	/**
	 * List of buttons by the "Actions" button
	 *
	 * Список кнопочек по кнопке "Действия"
	 */

	const actionsPopupButtons = [
		{
			get msg() {
				return I18N('OUTLAND')
			},
			result: function () {
				confShow(`${I18N('RUN_SCRIPT')} ${I18N('OUTLAND')}?`, getOutland);
			},
			get title() {
				return I18N('OUTLAND_TITLE');
			},
		},
		{
			get msg() {
				return I18N('TOWER')
			},
			result: function () {
				confShow(`${I18N('RUN_SCRIPT')} ${I18N('TOWER')}?`, testTower);
			},
			get title() {
				return I18N('TOWER_TITLE');
			},
		},
		{
			get msg() {
				return I18N('EXPEDITIONS')
			},
			result: function () {
				confShow(`${I18N('RUN_SCRIPT')} ${I18N('EXPEDITIONS')}?`, checkExpedition);
			},
			get title() {
				return I18N('EXPEDITIONS_TITLE');
			},
		},
		{
			get msg() {
				return I18N('MINIONS')
			},
			result: function () {
				confShow(`${I18N('RUN_SCRIPT')} ${I18N('MINIONS')}?`, testRaidNodes);
			},
			get title() {
				return I18N('MINIONS_TITLE');
			},
		},
		{
			get msg() {
				return I18N('ESTER_EGGS')
			},
			result: function () {
				confShow(`${I18N('RUN_SCRIPT')} ${I18N('ESTER_EGGS')}?`, offerFarmAllReward);
			},
			get title() {
				return I18N('ESTER_EGGS_TITLE');
			},
		},
		{
			get msg() {
				return I18N('STORM')
			},
			result: function () {
				testAdventure('solo');
			},
			get title() {
				return I18N('STORM_TITLE');
			},
		},
		{
			get msg() {
				return I18N('REWARDS')
			},
			result: function () {
				confShow(`${I18N('RUN_SCRIPT')} ${I18N('REWARDS')}?`, questAllFarm);
			},
			get title() {
				return I18N('REWARDS_TITLE');
			},
		},
		{
			get msg() {
				return I18N('MAIL')
			},
			result: function () {
				confShow(`${I18N('RUN_SCRIPT')} ${I18N('MAIL')}?`, mailGetAll);
			},
			get title() {
				return I18N('MAIL_TITLE');
			},
		},
		{
			get msg() {
				return I18N('SEER')
			},
			result: function () {
				confShow(`${I18N('RUN_SCRIPT')} ${I18N('SEER')}?`, rollAscension);
			},
			get title() {
				return I18N('SEER_TITLE');
			},
		},
		// {
		// 	get msg() {
		// 		return I18N('NY_GIFTS')
		// 	},
		// 	result: getGiftNewYear,
		// 	get title() { return I18N('NY_GIFTS_TITLE'); },
		// },
	];

	/**
	 * List of buttons by the "Others" button
	 *
	 * Список кнопочек по кнопке "Разное"
	 */
	const othersPopupButtons = [
		{
			get msg() {
				return I18N('GET_ENERGY')
			},
			result: farmStamina,
			get title() {
				return I18N('GET_ENERGY_TITLE');
			},
		},
		{
			get msg() {
				return I18N('ITEM_EXCHANGE')
			},
			result: fillActive,
			get title() {
				return I18N('ITEM_EXCHANGE_TITLE');
			},
		},
		{
			get msg() {
				return I18N('BUY_SOULS')
			},
			result: function () {
				confShow(`${I18N('RUN_SCRIPT')} ${I18N('BUY_SOULS')}?`, buyHeroFragments);
			},
			get title() {
				return I18N('BUY_SOULS_TITLE');
			},
		},
		{
			get msg() {
				return I18N('BUY_FOR_GOLD')
			},
			result: function () {
				confShow(`${I18N('RUN_SCRIPT')} ${I18N('BUY_FOR_GOLD')}?`, buyInStoreForGold);
			},
			get title() {
				return I18N('BUY_FOR_GOLD_TITLE');
			},
		},
		{
			get msg() {
				return I18N('BUY_OUTLAND')
			},
			result: bossOpenChestPay,
			get title() {
				return I18N('BUY_OUTLAND_TITLE');
			},
		},
		{
			get msg() {
				return I18N('CLAN_STAT')
			},
			result: clanStatistic,
			get title() {
				return I18N('CLAN_STAT_TITLE');
			},
		},
		{
			get msg() {
				return I18N('EPIC_BRAWL')
			},
			result: async function () {
				confShow(`${I18N('RUN_SCRIPT')} ${I18N('EPIC_BRAWL')}?`, () => {
					const brawl = new epicBrawl();
					brawl.start();
				});
			},
			get title() {
				return I18N('EPIC_BRAWL_TITLE');
			},
		},
		{
			get msg() {
				return I18N('ARTIFACTS_UPGRADE')
			},
			result: updateArtifacts,
			get title() {
				return I18N('ARTIFACTS_UPGRADE_TITLE');
			},
		},
		{
			get msg() {
				return I18N('SKINS_UPGRADE')
			},
			result: updateSkins,
			get title() {
				return I18N('SKINS_UPGRADE_TITLE');
			},
		},
		{
			get msg() {
				return I18N('SEASON_REWARD')
			},
			result: farmBattlePass,
			get title() {
				return I18N('SEASON_REWARD_TITLE');
			},
		},
		{
			get msg() {
				return I18N('SELL_HERO_SOULS')
			},
			result: sellHeroSoulsForGold,
			get title() {
				return I18N('SELL_HERO_SOULS_TITLE');
			},
		},
		{
			get msg() {
				return I18N('CHANGE_MAP')
			},
			result: async function () {
				const maps = Object.values(lib.data.seasonAdventure.list)
					.filter((e) => e.map.cells.length > 3)
					.map((i) => ({
						msg: I18N('MAP_NUM', { num: i.id }),
						result: i.id,
					}));

				const result = await popup.confirm(I18N('SELECT_ISLAND_MAP'), [...maps, { result: false, isClose: true }]);
				if (result) {
					cheats.changeIslandMap(result);
				}
			},
			get title() {
				return I18N('CHANGE_MAP_TITLE');
			},
		},
		{
			get msg() {
				return I18N('HERO_POWER')
			},
			result: async () => {
				const calls = ['userGetInfo', 'heroGetAll'].map((name) => ({
					name,
					args: {},
					ident: name,
				}));
				const [maxHeroSumPower, heroSumPower] = await Send({ calls }).then((e) => [
					e.results[0].result.response.maxSumPower.heroes,
					Object.values(e.results[1].result.response).reduce((a, e) => a + e.power, 0),
				]);
				const power = maxHeroSumPower - heroSumPower;
				let msg =
					I18N('MAX_POWER_REACHED', { power: maxHeroSumPower.toLocaleString() }) +
					'<br>' +
					I18N('CURRENT_POWER', { power: heroSumPower.toLocaleString() }) +
					'<br>' +
					I18N('POWER_TO_MAX', { power: power.toLocaleString(), color: power >= 4000 ? 'green' : 'red' });
				await popup.confirm(msg, [{ msg: I18N('BTN_OK'), result: 0 }]);
			},
			get title() {
				return I18N('HERO_POWER_TITLE');
			},
		},
	];
	/**
	 * Display buttons
	 *
	 * Вывести кнопочки
	 */
	function addControlButtons() {
		const { ScriptMenu } = HWHClasses;
		const scriptMenu = ScriptMenu.getInst();
		const { buttons } = HWHData;
		for (let name in buttons) {
			button = buttons[name];
			if (button.hide) {
				continue;
			}
			if (button.isCombine) {
				button['button'] = scriptMenu.addCombinedButton(button.combineList);
				continue;
			}
			button['button'] = scriptMenu.addButton(button);
		}
	}
	/**
	 * Adds links
	 *
	 * Добавляет ссылки
	 */
	function addBottomUrls() {
		const { ScriptMenu } = HWHClasses;
		const scriptMenu = ScriptMenu.getInst();
		scriptMenu.addHeader(I18N('BOTTOM_URLS'));
	}
	/**
	 * Stop repetition of the mission
	 *
	 * Остановить повтор миссии
	 */
	let isStopSendMission = false;
	/**
	 * There is a repetition of the mission
	 *
	 * Идет повтор миссии
	 */
	let isSendsMission = false;
	/**
	 * Data on the past mission
	 *
	 * Данные о прошедшей мисии
	 */
	let lastMissionStart = {}
	/**
	 * Start time of the last battle in the company
	 *
	 * Время начала последнего боя в кампании
	 */
	let lastMissionBattleStart = 0;
	/**
	 * Data for calculating the last battle with the boss
	 *
	 * Данные для расчете последнего боя с боссом
	 */
	let lastBossBattle = null;
	/**
	 * Information about the last battle
	 *
	 * Данные о прошедшей битве
	 */
	let lastBattleArg = {}
	let lastBossBattleStart = null;
	this.addBattleTimer = 4;
	this.invasionTimer = 2500;
	const invasionInfo = {
		id: 157,
		buff: 0,
		bossLvl: 130,
	};
	const invasionDataPacks = {
		130: { buff: 0, pet: 6005, heroes: [55, 58, 63, 52, 47], favor: { 47: 6001, 52: 6003, 55: 6005, 58: 6002, 63: 6000 }, timer: 0 },
		140: { buff: 0, pet: 6005, heroes: [55, 58, 63, 52, 47], favor: { 47: 6001, 52: 6003, 55: 6005, 58: 6002, 63: 6000 }, timer: 0 },
		150: { buff: 0, pet: 6005, heroes: [55, 58, 63, 52, 47], favor: { 47: 6001, 52: 6003, 55: 6005, 58: 6002, 63: 6000 }, timer: 0 },
		160: { buff: 0, pet: 6006, heroes: [55, 63, 48, 52, 42], favor: { 42: 6001, 48: 6005, 52: 6003, 55: 6007, 63: 6000 }, timer: 0 },
		170: { buff: 0, pet: 6005, heroes: [55, 58, 63, 48, 51], favor: { 48: 6005, 51: 6006, 55: 6007, 58: 6008, 63: 6003 }, timer: 0 },
		180: { buff: 0, pet: 6002, heroes: [58, 44, 63, 45, 42], favor: { 42: 6006, 44: 6003, 45: 6002, 58: 6008, 63: 6000 }, timer: 0 },
		190: { buff: 0, pet: 6005, heroes: [55, 44, 63, 48, 52], favor: { 44: 6009, 48: 6005, 52: 6001, 55: 6007, 63: 6000 }, timer: 0 },
		200: { buff: 0, pet: 6005, heroes: [63, 48, 40, 52, 45], favor: { 45: 6002, 48: 6005, 52: 6001, 63: 6009 }, timer: 0 },
		210: { buff: 0, pet: 6005, heroes: [63, 48, 40, 52, 4], favor: { 4: 6007, 48: 6005, 52: 6001, 63: 6009 }, timer: 0 },
		220: { buff: 0, pet: 6006, heroes: [55, 63, 48, 52, 2], favor: { 2: 6000, 48: 6005, 52: 6001, 55: 6007, 63: 6009 }, timer: 28.91644659118315 },
		230: { buff: 0, pet: 6005, heroes: [55, 63, 48, 52, 47], favor: { 47: 6003, 48: 6005, 52: 6003, 55: 6005, 63: 6009 }, timer: 38.7890624894657 },
		240: { buff: 0, pet: 6005, heroes: [55, 63, 48, 52, 2], favor: { 2: 6001, 48: 6005, 52: 6003, 55: 6007, 63: 6009 }, timer: 2.6315625 },
		250: { buff: 0, pet: 6005, heroes: [55, 63, 48, 40, 52], favor: { 48: 6005, 52: 6003, 55: 6007, 63: 6009 }, timer: 2.396601562499999 },
		260: { buff: 0, pet: 6005, heroes: [46, 55, 63, 45, 2], favor: { 2: 6000, 45: 6002, 46: 6006, 55: 6007, 63: 6003 }, timer: 108.98437516287758 },
		270: { buff: 15, pet: 6005, heroes: [32, 55, 63, 48, 51], favor: { 32: 6007, 48: 6001, 51: 6001, 55: 6001, 63: 6000 }, timer: 67.77832032495091 },
		280: { buff: 25, pet: 6005, heroes: [55, 63, 48, 52, 47], favor: { 47: 6003, 48: 6005, 52: 6006, 55: 6007, 63: 6009 }, timer: 39.84937499999998 },
		290: { buff: 5, pet: 6005, heroes: [46, 55, 63, 48, 52], favor: { 46: 6006, 48: 6005, 52: 6003, 55: 6005, 63: 6003 }, timer: 20.053711007235812 },
		300: { buff: 35, pet: 6005, heroes: [55, 58, 63, 43, 51], favor: { 43: 6006, 51: 6006, 55: 6005, 58: 6005, 63: 6000 }, timer: 40.13671886177282 },
		//300: { buff: 70, pet: 6005, heroes: [55, 58, 63, 48, 51], favor: {48: 6005, 51: 6006, 55: 6007, 58: 6008, 63: 6009}, timer: 54.755859550678494 }
	};
	/**
	 * The name of the function of the beginning of the battle
	 *
	 * Имя функции начала боя
	 */
	let nameFuncStartBattle = '';
	/**
	 * The name of the function of the end of the battle
	 *
	 * Имя функции конца боя
	 */
	let nameFuncEndBattle = '';
	/**
	 * Data for calculating the last battle
	 *
	 * Данные для расчета последнего боя
	 */
	let lastBattleInfo = null;
	/**
	 * The ability to cancel the battle
	 *
	 * Возможность отменить бой
	 */
	let isCancalBattle = true;

	function setIsCancalBattle(value) {
		isCancalBattle = value;
	}

	/**
	 * Certificator of the last open nesting doll
	 *
	 * Идетификатор последней открытой матрешки
	 */
	let lastRussianDollId = null;
	/**
	 * Cancel the training guide
	 *
	 * Отменить обучающее руководство
	 */
	this.isCanceledTutorial = false;

	/**
	 * Data from the last question of the quiz
	 *
	 * Данные последнего вопроса викторины
	 */
	let lastQuestion = null;
	/**
	 * Answer to the last question of the quiz
	 *
	 * Ответ на последний вопрос викторины
	 */
	let lastAnswer = null;
	/**
	 * Flag for opening keys or titan artifact spheres
	 *
	 * Флаг открытия ключей или сфер артефактов титанов
	 */
	let artifactChestOpen = false;
	/**
	 * The name of the function to open keys or orbs of titan artifacts
	 *
	 * Имя функции открытия ключей или сфер артефактов титанов
	 */
	let artifactChestOpenCallName = '';
	let correctShowOpenArtifact = 0;
	/**
	 * Data for the last battle in the dungeon
	 * (Fix endless cards)
	 *
	 * Данные для последнего боя в подземке
	 * (Исправление бесконечных карт)
	 */
	let lastDungeonBattleData = null;
	/**
	 * Start time of the last battle in the dungeon
	 *
	 * Время начала последнего боя в подземелье
	 */
	let lastDungeonBattleStart = 0;
	/**
	 * Subscription end time
	 *
	 * Время окончания подписки
	 */
	let subEndTime = 0;
	/**
	 * Number of prediction cards
	 *
	 * Количество карт предсказаний
	 */
	const countPredictionCard = 0;

	/**
	 * Brawl pack
	 *
	 * Пачка для потасовок
	 */
	let brawlsPack = null;

	let clanDominationGetInfo = null;
	/**
	 * Copies the text to the clipboard
	 *
	 * Копирует тест в буфер обмена
	 * @param {*} text copied text // копируемый текст
	 */
	function copyText(text) {
		const copyTextarea = document.createElement("textarea");
		copyTextarea.style.opacity = "0";
		copyTextarea.textContent = text;
		document.body.appendChild(copyTextarea);
		copyTextarea.select();
		document.execCommand("copy");
		document.body.removeChild(copyTextarea);
	}
	/**
	 * Returns the history of requests
	 *
	 * Возвращает историю запросов
	 */
	this.getRequestHistory = function() {
		return requestHistory;
	}
	/**
	 * Generates a random integer from min to max
	 *
	 * Гененирует случайное целое число от min до max
	 */
	const random = function (min, max) {
		return Math.floor(Math.random() * (max - min + 1) + min);
	}
	const randf = function (min, max) {
		return Math.random() * (max - min + 1) + min;
	};
	/**
	 * Clearing the request history
	 *
	 * Очистка истоии запросов
	 */
	setInterval(function () {
		let now = Date.now();
		for (let i in requestHistory) {
			const time = +i.split('_')[0];
			if (now - time > 300000) {
				delete requestHistory[i];
			}
		}
	}, 300000);
	/**
	 * Displays the dialog box
	 *
	 * Отображает диалоговое окно
	 */
	function confShow(message, yesCallback, noCallback) {
		let buts = [];
		message = message || I18N('DO_YOU_WANT');
		noCallback = noCallback || (() => {});
		if (yesCallback) {
			buts = [
				{ msg: I18N('BTN_RUN'), result: true},
				{ msg: I18N('BTN_CANCEL'), result: false, isCancel: true},
			]
		} else {
			yesCallback = () => {};
			buts = [
				{ msg: I18N('BTN_OK'), result: true},
			];
		}
		popup.confirm(message, buts).then((e) => {
			// dialogPromice = null;
			if (e) {
				yesCallback();
			} else {
				noCallback();
			}
		});
	}
	/**
	 * Override/proxy the method for creating a WS package send
	 *
	 * Переопределяем/проксируем метод создания отправки WS пакета
	 */
	WebSocket.prototype.send = function (data) {
		if (!this.isSetOnMessage) {
			const oldOnmessage = this.onmessage;
			this.onmessage = function (event) {
				try {
					const data = JSON.parse(event.data);
					if (!this.isWebSocketLogin && data.result.type == "iframeEvent.login") {
						this.isWebSocketLogin = true;
					} else if (data.result.type == "iframeEvent.login") {
						return;
					}
				} catch (e) { }
				return oldOnmessage.apply(this, arguments);
			}
			this.isSetOnMessage = true;
		}
		original.SendWebSocket.call(this, data);
	}
	/**
	 * Overriding/Proxying the Ajax Request Creation Method
	 *
	 * Переопределяем/проксируем метод создания Ajax запроса
	 */
	XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
		this.uniqid = Date.now() + '_' + random(1000000, 10000000);
		this.errorRequest = false;
		if (method == 'POST' && url.includes('.nextersglobal.com/api/') && /api\/$/.test(url)) {
			if (!apiUrl) {
				apiUrl = url;
				const socialInfo = /heroes-(.+?)\./.exec(apiUrl);
				console.log(socialInfo);
			}
			requestHistory[this.uniqid] = {
				method,
				url,
				error: [],
				headers: {},
				request: null,
				response: null,
				signature: [],
				calls: {},
			};
		} else if (method == 'POST' && url.includes('error.nextersglobal.com/client/')) {
			this.errorRequest = true;
		}
		return original.open.call(this, method, url, async, user, password);
	};
	/**
	 * Overriding/Proxying the header setting method for the AJAX request
	 *
	 * Переопределяем/проксируем метод установки заголовков для AJAX запроса
	 */
	XMLHttpRequest.prototype.setRequestHeader = function (name, value, check) {
		if (this.uniqid in requestHistory) {
			requestHistory[this.uniqid].headers[name] = value;
			if (name == 'X-Auth-Signature') {
				requestHistory[this.uniqid].signature.push(value);
				if (!check) {
					return;
				}
			}
		} else {
			check = true;
		}
		return original.setRequestHeader.call(this, name, value);
	};
	/**
	 * Overriding/Proxying the AJAX Request Sending Method
	 *
	 * Переопределяем/проксируем метод отправки AJAX запроса
	 */
	XMLHttpRequest.prototype.send = async function (sourceData) {
		if (this.uniqid in requestHistory) {
			let tempData = null;
			if (getClass(sourceData) == "ArrayBuffer") {
				tempData = decoder.decode(sourceData);
			} else {
				tempData = sourceData;
			}
			requestHistory[this.uniqid].request = tempData;
			let headers = requestHistory[this.uniqid].headers;
			lastHeaders = Object.assign({}, headers);
			/**
			 * Game loading event
			 *
			 * Событие загрузки игры
			 */
			if (headers["X-Request-Id"] > 2 && !isLoadGame) {
				isLoadGame = true;
				if (cheats.libGame) {
					lib.setData(cheats.libGame);
				} else {
					lib.setData(await cheats.LibLoad());
				}
				addControls();
				addControlButtons();
				addBottomUrls();

				// Auto-run minions attack on Mondays
				autoRunMinionsOnMonday();

				if (isChecked('sendExpedition')) {
					const isTimeBetweenDays = isTimeBetweenNewDays();
					if (!isTimeBetweenDays) {
						checkExpedition();
					} else {
						setProgress(I18N('EXPEDITIONS_NOTTIME'), true);
					}
				}

				getAutoGifts();

				cheats.activateHacks();

				justInfo();
				if (isChecked('dailyQuests')) {
					testDailyQuests();
				}

				// Auto run Do All function with all tasks checked
				testDoYourBest().then(() => {
					// Auto raid missions - run after arena attacks complete
					if (isChecked('autoRaidMission')) {
						console.log('%cAuto Raid Mission: Starting after arena attacks...', 'color: orange; font-weight: bold;');
						autoRaidMission();
					}
				}).catch(error => {
					console.error('Do Your Best function error:', error);
					// Still try to run auto raid mission even if Do Your Best fails
					if (isChecked('autoRaidMission')) {
						console.log('%cAuto Raid Mission: Starting after arena attacks (with error)...', 'color: orange; font-weight: bold;');
						autoRaidMission();
					}
				});

				if (isChecked('buyForGold')) {
					buyInStoreForGold();
				}
			}
			/**
			 * Outgoing request data processing
			 *
			 * Обработка данных исходящего запроса
			 */
			sourceData = await checkChangeSend.call(this, sourceData, tempData);
			/**
			 * Handling incoming request data
			 *
			 * Обработка данных входящего запроса
			 */
			const oldReady = this.onreadystatechange;
			this.onreadystatechange = async function (e) {
				if (this.errorRequest) {
					return oldReady.apply(this, arguments);
				}
				if(this.readyState == 4 && this.status == 200) {
					isTextResponse = this.responseType === "text" || this.responseType === "";
					let response = isTextResponse ? this.responseText : this.response;
					requestHistory[this.uniqid].response = response;
					/**
					 * Replacing incoming request data
					 *
					 * Заменна данных входящего запроса
					 */
					if (isTextResponse) {
						await checkChangeResponse.call(this, response);
					}
					/**
					 * A function to run after the request is executed
					 *
					 * Функция запускаемая после выполения запроса
					 */
					if (typeof this.onReadySuccess == 'function') {
						setTimeout(this.onReadySuccess, 500);
					}
					/** Удаляем из истории запросов битвы с боссом */
					if ('invasion_bossStart' in requestHistory[this.uniqid].calls) delete requestHistory[this.uniqid];
				}
				if (oldReady) {
					try {
						return oldReady.apply(this, arguments);
					} catch(e) {
						console.log(oldReady);
						console.error('Error in oldReady:', e);
					}

				}
			}
		}
		if (this.errorRequest) {
			const oldReady = this.onreadystatechange;
			this.onreadystatechange = function () {
				Object.defineProperty(this, 'status', {
					writable: true
				});
				this.status = 200;
				Object.defineProperty(this, 'readyState', {
					writable: true
				});
				this.readyState = 4;
				Object.defineProperty(this, 'responseText', {
					writable: true
				});
				this.responseText = JSON.stringify({
					"result": true
				});
				if (typeof this.onReadySuccess == 'function') {
					setTimeout(this.onReadySuccess, 200);
				}
				return oldReady.apply(this, arguments);
			}
			this.onreadystatechange();
		} else {
			try {
				return original.send.call(this, sourceData);
			} catch(e) {
				debugger;
			}

		}
	};
	/**
	 * Processing and substitution of outgoing data
	 *
	 * Обработка и подмена исходящих данных
	 */
	async function checkChangeSend(sourceData, tempData) {
		try {
			/**
			 * A function that replaces battle data with incorrect ones to cancel combatя
			 *
			 * Функция заменяющая данные боя на неверные для отмены боя
			 */
			const fixBattle = function (heroes) {
				for (const ids in heroes) {
					hero = heroes[ids];
					hero.energy = random(1, 999);
					if (hero.hp > 0) {
						hero.hp = random(1, hero.hp);
					}
				}
			}
			/**
			 * Dialog window 2
			 *
			 * Диалоговое окно 2
			 */
			const showMsg = async function (msg, ansF, ansS) {
				if (typeof popup == 'object') {
					return await popup.confirm(msg, [
						{msg: ansF, result: false},
						{msg: ansS, result: true},
					]);
				} else {
					return !confirm(`${msg}\n ${ansF} (${I18N('BTN_OK')})\n ${ansS} (${I18N('BTN_CANCEL')})`);
				}
			}
			/**
			 * Dialog window 3
			 *
			 * Диалоговое окно 3
			 */
			const showMsgs = async function (msg, ansF, ansS, ansT) {
				return await popup.confirm(msg, [
					{msg: ansF, result: 0},
					{msg: ansS, result: 1},
					{msg: ansT, result: 2},
				]);
			}

			let changeRequest = false;
			const testData = JSON.parse(tempData);
			for (const call of testData.calls) {
				if (!artifactChestOpen) {
					requestHistory[this.uniqid].calls[call.name] = call.ident;
				}
				/**
				 * Cancellation of the battle in adventures, on VG and with minions of Asgard
				 * Отмена боя в приключениях, на ВГ и с прислужниками Асгарда
				 */
				if ((call.name == 'adventure_endBattle' ||
					call.name == 'adventureSolo_endBattle' ||
					call.name == 'clanWarEndBattle' &&
					isChecked('cancelBattle') ||
					call.name == 'crossClanWar_endBattle' &&
					isChecked('cancelBattle') ||
					call.name == 'brawl_endBattle' ||
					call.name == 'towerEndBattle' ||
					call.name == 'invasion_bossEnd' ||
					call.name == 'titanArenaEndBattle' ||
					call.name == 'bossEndBattle' ||
					call.name == 'clanRaid_endNodeBattle') &&
					isCancalBattle) {
					nameFuncEndBattle = call.name;

					if (isChecked('tryFixIt_v2') &&
						!call.args.result.win &&
						(call.name == 'brawl_endBattle' ||
						//call.name == 'crossClanWar_endBattle' ||
						call.name == 'epicBrawl_endBattle' ||
						//call.name == 'clanWarEndBattle' ||
						call.name == 'adventure_endBattle' ||
						// call.name == 'titanArenaEndBattle' ||
						call.name == 'bossEndBattle' ||
						call.name == 'adventureSolo_endBattle') &&
						lastBattleInfo) {
						const noFixWin = call.name == 'clanWarEndBattle' || call.name == 'crossClanWar_endBattle';
						const cloneBattle = structuredClone(lastBattleInfo);
						lastBattleInfo = null;
						try {
							const { BestOrWinFixBattle } = HWHClasses;
							const bFix = new BestOrWinFixBattle(cloneBattle);
							bFix.setNoMakeWin(noFixWin);
							let endTime = Date.now() + 3e4;
							if (endTime < cloneBattle.endTime) {
								endTime = cloneBattle.endTime;
							}
							const result = await bFix.start(cloneBattle.endTime, 500);

							if (result.result?.win) {
								call.args.result = result.result;
								call.args.progress = result.progress;
								changeRequest = true;
							} else if (result.value > 0) {
								if (
									await popup.confirm(I18N('DEFEAT') + '<br>' + I18N('BEST_RESULT', { value: result.value }), [
										{ msg: I18N('BTN_CANCEL'), result: 0 },
										{ msg: I18N('BTN_ACCEPT'), result: 1 },
									])
								) {
									call.args.result = result.result;
									call.args.progress = result.progress;
									changeRequest = true;
								}
							}
						} catch (error) {
							console.error(error);
						}
					}

					if (isChecked('tryFixIt_v2') && !call.args.result.win && call.name == 'invasion_bossEnd' && lastBattleInfo) {
						setProgress(I18N('LETS_FIX'), false);
						const cloneBattle = structuredClone(lastBattleInfo);
						const bFix = new WinFixBattle(cloneBattle);
						const result = await bFix.start(cloneBattle.endTime, 500);
						console.log(result);
						let msgResult = I18N('DEFEAT');
						if (result.result?.win) {
							call.args.result = result.result;
							call.args.progress = result.progress;
							msgResult = I18N('VICTORY');
							changeRequest = true;
						}
						setProgress(msgResult, false, hideProgress);
						if (lastBattleInfo.seed === 8888) {
							let timer = result.battleTimer;
							const period = Math.ceil((Date.now() - lastBossBattleStart) / 1000);
							console.log(timer, period);
							if (period < timer) {
								timer = timer - period;
								await countdownTimer(timer);
								lastBattleInfo.timer = true;
							}
						}
					}

					if (!call.args.result.win) {
						let resultPopup = false;
						if (
							call.name == 'adventure_endBattle' ||
							//call.name == 'invasion_bossEnd' ||
							call.name == 'bossEndBattle' ||
							// call.name == 'titanArenaEndBattle' ||
							call.name == 'adventureSolo_endBattle'
						) {
							resultPopup = await showMsgs(I18N('MSG_HAVE_BEEN_DEFEATED'), I18N('BTN_OK'), I18N('BTN_CANCEL'), I18N('BTN_AUTO'));
						} else if (call.name == 'clanWarEndBattle' || call.name == 'crossClanWar_endBattle') {
							resultPopup = await showMsg(I18N('MSG_HAVE_BEEN_DEFEATED'), I18N('BTN_OK'), I18N('BTN_AUTO_F5'));
						} else if (call.name !== 'epicBrawl_endBattle' && call.name !== 'titanArenaEndBattle') {
							resultPopup = await showMsg(I18N('MSG_HAVE_BEEN_DEFEATED'), I18N('BTN_OK'), I18N('BTN_CANCEL'));
						}
						if (resultPopup) {
							if (call.name == 'invasion_bossEnd') {
								this.errorRequest = true;
							}
							fixBattle(call.args.progress[0].attackers.heroes);
							fixBattle(call.args.progress[0].defenders.heroes);
							changeRequest = true;
							if (resultPopup > 1) {
								this.onReadySuccess = testAutoBattle;
								// setTimeout(bossBattle, 1000);
							}
						}
					} else if (call.args.result.stars < 3 && call.name == 'towerEndBattle') {
						resultPopup = await showMsg(I18N('LOST_HEROES'), I18N('BTN_OK'), I18N('BTN_CANCEL'), I18N('BTN_AUTO'));
						if (resultPopup) {
							fixBattle(call.args.progress[0].attackers.heroes);
							fixBattle(call.args.progress[0].defenders.heroes);
							changeRequest = true;
							if (resultPopup > 1) {
								this.onReadySuccess = testAutoBattle;
							}
						}
					}
					// Потасовки
					if (isChecked('autoBrawls') && !HWHClasses.executeBrawls.isBrawlsAutoStart && call.name == 'brawl_endBattle') {
					}
				}
				/**
				 * Save pack for Brawls
				 *
				 * Сохраняем пачку для потасовок
				 */
				if (isChecked('autoBrawls') && !HWHClasses.executeBrawls.isBrawlsAutoStart && call.name == 'brawl_startBattle') {
					console.log(JSON.stringify(call.args));
					brawlsPack = call.args;
					if (
						await popup.confirm(
							I18N('START_AUTO_BRAWLS'),
							[
								{ msg: I18N('BTN_NO'), result: false },
								{ msg: I18N('BTN_YES'), result: true },
							],
							[
								{
									name: 'isAuto',
									get label() {
										return I18N('BRAWL_AUTO_PACK');
									},
									checked: false,
								},
							]
						)
					) {
						HWHClasses.executeBrawls.isBrawlsAutoStart = true;
						const isAuto = popup.getCheckBoxes().find((e) => e.name === 'isAuto');
						this.errorRequest = true;
						testBrawls(isAuto.checked);
					}
				}
				/**
				 * Canceled fight in Asgard
				 * Отмена боя в Асгарде
				 */
				if (call.name == 'clanRaid_endBossBattle' && isChecked('cancelBattle')) {
					const bossDamage = call.args.progress[0].defenders.heroes[1].extra;
					let maxDamage = bossDamage.damageTaken + bossDamage.damageTakenNextLevel;
					const lastDamage = maxDamage;

					const testFunc = [];

					if (testFuntions.masterFix) {
						testFunc.push({ msg: 'masterFix', isInput: true, default: 100 });
					}

					const resultPopup = await popup.confirm(
						`${I18N('MSG_YOU_APPLIED')} ${lastDamage.toLocaleString()} ${I18N('MSG_DAMAGE')}.`,
						[
							{ msg: I18N('BTN_OK'), result: false },
							{ msg: I18N('BTN_AUTO_F5'), result: 1 },
							//{ msg: I18N('BTN_TRY_FIX_IT'), result: 2 },
							...testFunc,
						],
						[
							{
								name: 'isStat',
								get label() { return I18N('CALC_STAT'); },
								checked: false,
							},
						]
					);
					if (resultPopup) {
						if (resultPopup == 2) {
							// Отключено/Disabled
							setProgress(I18N('LETS_FIX'), false);
							await new Promise((e) => setTimeout(e, 0));
							const cloneBattle = structuredClone(lastBossBattle);
							const endTime = cloneBattle.endTime - 15e3;
							console.log('fixBossBattleStart');

							const { BossFixBattle } = HWHClasses;
							const bFix = new BossFixBattle(cloneBattle);
							const result = await bFix.start(endTime, 500);
							console.log(result);

							let msgResult = I18N('DAMAGE_NO_FIXED', {
								lastDamage: lastDamage.toLocaleString(),
							});
							if (result.value > lastDamage) {
								call.args.result = result.result;
								call.args.progress = result.progress;
								msgResult = I18N('DAMAGE_FIXED', {
									lastDamage: lastDamage.toLocaleString(),
									maxDamage: result.value.toLocaleString(),
								});
							}
							console.log(lastDamage, '>', result.value);
							setProgress(
								msgResult +
									'<br/>' +
									I18N('COUNT_FIXED', {
										count: result.maxCount,
									}),
								false,
								hideProgress
							);
						} else if (resultPopup > 3) {
							const cloneBattle = structuredClone(lastBossBattle);
							const { masterFixBattle } = HWHClasses;
							const mFix = new masterFixBattle(cloneBattle);
							const result = await mFix.start(cloneBattle.endTime, resultPopup);
							console.log(result);
							let msgResult = I18N('DAMAGE_NO_FIXED', {
								lastDamage: lastDamage.toLocaleString(),
							});
							if (result.value > lastDamage) {
								maxDamage = result.value;
								call.args.result = result.result;
								call.args.progress = result.progress;
								msgResult = I18N('DAMAGE_FIXED', {
									lastDamage: lastDamage.toLocaleString(),
									maxDamage: maxDamage.toLocaleString(),
								});
							}
							console.log('Урон:', lastDamage, maxDamage);
							setProgress(msgResult, false, hideProgress);
						} else {
							fixBattle(call.args.progress[0].attackers.heroes);
							fixBattle(call.args.progress[0].defenders.heroes);
						}
						changeRequest = true;
					}
					const isStat = popup.getCheckBoxes().find((e) => e.name === 'isStat');
					if (isStat.checked) {
						this.onReadySuccess = testBossBattle;
					}
				}
				/**
				 * Save the Asgard Boss Attack Pack
				 * Сохраняем пачку для атаки босса Асгарда
				 */
				if (call.name == 'clanRaid_startBossBattle') {
					console.log(JSON.stringify(call.args));
				}
				/**
				 * Saving the request to start the last battle
				 * Сохранение запроса начала последнего боя
				 */
				if (
					call.name == 'clanWarAttack' ||
					call.name == 'crossClanWar_startBattle' ||
					call.name == 'adventure_turnStartBattle' ||
					call.name == 'adventureSolo_turnStartBattle' ||
					call.name == 'bossAttack' ||
					call.name == 'invasion_bossStart' ||
					call.name == 'towerStartBattle'
				) {
					nameFuncStartBattle = call.name;
					lastBattleArg = call.args;

					if (call.name == 'invasion_bossStart') {
						const { invasionInfo } = HWHData;
						console.log(invasionInfo.bossLvl, JSON.stringify({
							buff: invasionInfo.buff,
							pet: lastBattleArg.pet,
							heroes: lastBattleArg.heroes,
							favor: lastBattleArg.favor,
							timer: 0,
						}));
						const timePassed = Date.now() - lastBossBattleStart;
						if (timePassed < invasionTimer) {
							await new Promise((e) => setTimeout(e, invasionTimer - timePassed));
						}
						invasionTimer -= 1;
					}
					lastBossBattleStart = Date.now();
				}
				if (call.name == 'invasion_bossEnd') {
					const lastBattle = lastBattleInfo;
					if (lastBattle && call.args.result.win) {
						if (lastBattle.seed === 8008) {
							lastBattle.progress = call.args.progress;
							const result = await Calc(lastBattle);
							let timer = getTimer(result.battleTime, 1) + addBattleTimer;
							const period = Math.ceil((Date.now() - lastBossBattleStart) / 1000);
							console.log(timer, period);
							if (period < timer) {
								timer = timer - period;
								await countdownTimer(timer);
							}
						}
					}
				}
				/**
				 * Disable spending divination cards
				 * Отключить трату карт предсказаний
				 */
				if (call.name == 'dungeonEndBattle') {
					if (call.args.isRaid) {
						if (HWHData.countPredictionCard <= 0) {
							delete call.args.isRaid;
							changeRequest = true;
						} else if (HWHData.countPredictionCard > 0) {
							HWHData.countPredictionCard--;
						}
					}
					console.log(`Cards: ${HWHData.countPredictionCard}`);
					/**
					 * Fix endless cards
					 * Исправление бесконечных карт
					 */
					const lastBattle = lastDungeonBattleData;
					if (lastBattle && !call.args.isRaid) {
						if (changeRequest) {
							lastBattle.progress = [{ attackers: { input: ["auto", 0, 0, "auto", 0, 0] } }];
						} else {
							lastBattle.progress = call.args.progress;
						}
						const result = await Calc(lastBattle);

						if (changeRequest) {
							call.args.progress = result.progress;
							call.args.result = result.result;
						}

						let timer = result.battleTimer + addBattleTimer;
						const period = Math.ceil((Date.now() - lastDungeonBattleStart) / 1000);
						console.log(timer, period);
						if (period < timer) {
							timer = timer - period;
							await countdownTimer(timer);
						}
					}
				}
				/**
				 * Quiz Answer
				 * Ответ на викторину
				 */
				if (call.name == 'quiz_answer') {
					/**
					 * Automatically changes the answer to the correct one if there is one.
					 * Автоматически меняет ответ на правильный если он есть
					 */
					if (lastAnswer && isChecked('getAnswer')) {
						call.args.answerId = lastAnswer;
						lastAnswer = null;
						changeRequest = true;
					}
				}
				/**
				 * Present
				 * Подарки
				 */
				if (call.name == 'freebieCheck') {
					freebieCheckInfo = call;
				}
				/** missionTimer */
				if (call.name == 'missionEnd' && missionBattle) {
					let startTimer = false;
					if (!call.args.result.win) {
						startTimer = await popup.confirm(I18N('DEFEAT_TURN_TIMER'), [
							{ msg: I18N('BTN_NO'), result: false },
							{ msg: I18N('BTN_YES'), result: true },
						]);
					}

					if (call.args.result.win || startTimer) {
						missionBattle.progress = call.args.progress;
						missionBattle.result = call.args.result;
						const result = await Calc(missionBattle);

						let timer = result.battleTimer + addBattleTimer;
						const period = Math.ceil((Date.now() - lastMissionBattleStart) / 1000);
						if (period < timer) {
							timer = timer - period;
							await countdownTimer(timer);
						}
						missionBattle = null;
					} else {
						this.errorRequest = true;
					}
				}
				/**
				 * Getting mission data for auto-repeat
				 * Получение данных миссии для автоповтора
				 */
				if (isChecked('repeatMission') &&
					call.name == 'missionEnd') {
					let missionInfo = {
						id: call.args.id,
						result: call.args.result,
						heroes: call.args.progress[0].attackers.heroes,
						count: 0,
					}
					setTimeout(async () => {
						if (!isSendsMission && await popup.confirm(I18N('MSG_REPEAT_MISSION'), [
								{ msg: I18N('BTN_REPEAT'), result: true},
								{ msg: I18N('BTN_NO'), result: false},
							])) {
							isStopSendMission = false;
							isSendsMission = true;
							sendsMission(missionInfo);
						}
					}, 0);
				}
				/**
				 * Getting mission data
				 * Получение данных миссии
				 * missionTimer
				 */
				if (call.name == 'missionStart') {
					lastMissionStart = call.args;
					lastMissionBattleStart = Date.now();
				}

				/**
				 * Specify the quantity for Titan Orbs and Pet Eggs
				 * Указать количество для сфер титанов и яиц петов
				 */
				if (isChecked('countControl') &&
					(call.name == 'pet_chestOpen' ||
					call.name == 'titanUseSummonCircle') &&
					call.args.amount > 1) {
					const startAmount = call.args.amount;
					const result = await popup.confirm(I18N('MSG_SPECIFY_QUANT'), [
						{ msg: I18N('BTN_OPEN'), isInput: true, default: 1},
						]);
					if (result) {
						const item = call.name == 'pet_chestOpen' ? { id: 90, type: 'consumable' } : { id: 13, type: 'coin' };
						cheats.updateInventory({
							[item.type]: {
								[item.id]: -(result - startAmount),
							},
						});
						call.args.amount = result;
						changeRequest = true;
					}
				}
				/**
				 * Specify the amount for keys and spheres of titan artifacts
				 * Указать колличество для ключей и сфер артефактов титанов
				 */
				if (isChecked('countControl') &&
					(call.name == 'artifactChestOpen' ||
					call.name == 'titanArtifactChestOpen') &&
					call.args.amount > 1 &&
					call.args.free &&
					!changeRequest) {
					artifactChestOpenCallName = call.name;
					const startAmount = call.args.amount;
					let result = await popup.confirm(I18N('MSG_SPECIFY_QUANT'), [
						{ msg: I18N('BTN_OPEN'), isInput: true, default: 1 },
					]);
					if (result) {
						const openChests = result;
						let sphere = result < 10 ? 1 : 10;
						call.args.amount = sphere;
						for (let count = openChests - sphere; count > 0; count -= sphere) {
							if (count < 10) sphere = 1;
							const ident = artifactChestOpenCallName + "_" + count;
							testData.calls.push({
								name: artifactChestOpenCallName,
								args: {
									amount: sphere,
									free: true,
								},
								ident: ident
							});
							if (!Array.isArray(requestHistory[this.uniqid].calls[call.name])) {
								requestHistory[this.uniqid].calls[call.name] = [requestHistory[this.uniqid].calls[call.name]];
							}
							requestHistory[this.uniqid].calls[call.name].push(ident);
						}

						const consumableId = call.name == 'artifactChestOpen' ? 45 : 55;
						cheats.updateInventory({
							consumable: {
								[consumableId]: -(openChests - startAmount),
							},
						});
						artifactChestOpen = true;
						changeRequest = true;
					}
				}
				if (call.name == 'consumableUseLootBox') {
					lastRussianDollId = call.args.libId;
					/**
					 * Specify quantity for Platinum Box and Heroes Box
					 * Указать количество для платиновых шкатулок и ящиков с героями
					 */
					const lootBoxInfo = lib.data.inventoryItem.consumable[call.args.libId];
					const playerChoiceType = lootBoxInfo?.effectDescription?.playerChoiceType;
					if (isChecked('countControl') &&
						((call.args.libId == 148 && call.args.amount > 1) || playerChoiceType === 'hero')) {
						const result = await popup.confirm(I18N('MSG_SPECIFY_QUANT'), [
							{ msg: I18N('BTN_OPEN'), isInput: true, default: call.args.amount },
						]);
						call.args.amount = result;
						changeRequest = true;
					}
					if (isChecked('countControl') && call.args.libId >= 362 && call.args.libId <= 389) {
						this.massOpen = call.args.libId;
					}
				}
				if (call.name == 'invasion_bossStart' && isChecked('tryFixIt_v2')) {
					const { invasionInfo, invasionDataPacks } = HWHData;
					if (call.args.id == invasionInfo.id) {
						const pack = invasionDataPacks[invasionInfo.bossLvl];
						if (pack) {
							if (pack.buff != invasionInfo.buff) {
								setProgress(
									I18N('INVASION_BOSS_BUFF', {
										bossLvl: invasionInfo.bossLvl,
										needBuff: pack.buff,
										haveBuff: invasionInfo.buff,
									}),
									false
								);
							} else {
								call.args.pet = pack.pet;
								call.args.heroes = pack.heroes;
								call.args.favor = pack.favor;
								changeRequest = true;
							}
						}
					}
				}
				if (call.name == 'workshopBuff_create') {
					const { invasionInfo, invasionDataPacks } = HWHData;
					const pack = invasionDataPacks[invasionInfo.bossLvl];
					if (pack) {
						const addBuff = call.args.amount * 5;
						if (pack.buff < addBuff + invasionInfo.buff) {
							this.errorRequest = true;
						}
						setProgress(
							I18N('INVASION_BOSS_BUFF', {
								bossLvl: invasionInfo.bossLvl,
								needBuff: pack.buff,
								haveBuff: invasionInfo.buff,
							}),
							false
						);
					}
				}
				if (call.name == 'saleShowcase_rewardInfo') {
					this[call.name] = {
						offerId: call.args.offerId,
					};
				}
				/**
				 * Changing the maximum number of raids in the campaign
				 * Изменение максимального количества рейдов в кампании
				 */
				// if (call.name == 'missionRaid') {
				// 	if (isChecked('countControl') && call.args.times > 1) {
				// 		const result = +(await popup.confirm(I18N('MSG_SPECIFY_QUANT'), [
				// 			{ msg: I18N('BTN_RUN'), isInput: true, default: call.args.times },
				// 		]));
				// 		call.args.times = result > call.args.times ? call.args.times : result;
				// 		changeRequest = true;
				// 	}
				// }
			}

			let headers = requestHistory[this.uniqid].headers;
			if (changeRequest) {
				sourceData = JSON.stringify(testData);
				headers['X-Auth-Signature'] = getSignature(headers, sourceData);
			}

			let signature = headers['X-Auth-Signature'];
			if (signature) {
				original.setRequestHeader.call(this, 'X-Auth-Signature', signature);
			}
		} catch (err) {
			console.log("Request(send, " + this.uniqid + "):\n", sourceData, "Error:\n", err);
		}
		return sourceData;
	}
	/**
	 * Processing and substitution of incoming data
	 *
	 * Обработка и подмена входящих данных
	 */
	async function checkChangeResponse(response) {
		try {
			isChange = false;
			let nowTime = Math.round(Date.now() / 1000);
			callsIdent = requestHistory[this.uniqid].calls;
			respond = JSON.parse(response);
			/**
			 * If the request returned an error removes the error (removes synchronization errors)
			 * Если запрос вернул ошибку удаляет ошибку (убирает ошибки синхронизации)
			 */
			if (respond.error) {
				isChange = true;
				console.error(respond.error);
				if (isChecked('showErrors')) {
					popup.confirm(I18N('ERROR_MSG', {
						name: respond.error.name,
						description: respond.error.description,
					}));
				}
				if (respond.error.name != 'AccountBan') {
					delete respond.error;
					respond.results = [];
				}
			}
			let mainReward = null;
			const allReward = {};
			let countTypeReward = 0;
			let readQuestInfo = false;
			for (const call of respond.results) {
				/**
				 * Obtaining initial data for completing quests
				 * Получение исходных данных для выполнения квестов
				 */
				if (readQuestInfo) {
					questsInfo[call.ident] = call.result.response;
				}
				/**
				 * Getting a user ID
				 * Получение идетификатора пользователя
				 */
				if (call.ident == callsIdent['registration']) {
					userId = call.result.response.userId;
					if (localStorage['userId'] != userId) {
						localStorage['newGiftSendIds'] = '';
						localStorage['userId'] = userId;
					}
					await openOrMigrateDatabase(userId);
					readQuestInfo = true;
				}
				/**
				 * Hiding donation offers 1
				 * Скрываем предложения доната 1
				 */
				if (call.ident == callsIdent['billingGetAll'] && getSaveVal('noOfferDonat')) {
					const billings = call.result.response?.billings;
					const bundle = call.result.response?.bundle;
					if (billings && bundle) {
						call.result.response.billings = call.result.response.billings.filter((e) => ['repeatableOffer'].includes(e.type));
						call.result.response.bundle = [];
						isChange = true;
					}
				}
				/**
				 * Hiding donation offers 2
				 * Скрываем предложения доната 2
				 */
				if (getSaveVal('noOfferDonat') &&
					(call.ident == callsIdent['offerGetAll'] ||
						call.ident == callsIdent['specialOffer_getAll'])) {
					let offers = call.result.response;
					if (offers) {
						call.result.response = offers.filter(
							(e) => !['addBilling', 'bundleCarousel'].includes(e.type) || ['idleResource', 'stagesOffer'].includes(e.offerType)
						);
						isChange = true;
					}
				}
				/**
				 * Hiding donation offers 3
				 * Скрываем предложения доната 3
				 */
				if (getSaveVal('noOfferDonat') && call.result?.bundleUpdate) {
					delete call.result.bundleUpdate;
					isChange = true;
				}
				/**
				 * Hiding donation offers 4
				 * Скрываем предложения доната 4
				 */
				if (call.result?.specialOffers) {
					const offers = call.result.specialOffers;
					call.result.specialOffers = offers.filter(
						(e) => !['addBilling', 'bundleCarousel'].includes(e.type) || ['idleResource', 'stagesOffer'].includes(e.offerType)
					);
					isChange = true;
				}
				/**
				 * Copies a quiz question to the clipboard
				 * Копирует вопрос викторины в буфер обмена и получает на него ответ если есть
				 */
				if (call.ident == callsIdent['quiz_getNewQuestion']) {
					let quest = call.result.response;
					console.log(quest.question);
					copyText(quest.question);
					setProgress(I18N('QUESTION_COPY'), true);
					quest.lang = null;
					if (typeof NXFlashVars !== 'undefined') {
						quest.lang = NXFlashVars.interface_lang;
					}
					lastQuestion = quest;
					if (isChecked('getAnswer')) {
						const answer = await getAnswer(lastQuestion);
						let showText = '';
						if (answer) {
							lastAnswer = answer;
							console.log(answer);
							showText = `${I18N('ANSWER_KNOWN')}: ${answer}`;
						} else {
							showText = I18N('ANSWER_NOT_KNOWN');
						}

						try {
							const hint = hintQuest(quest);
							if (hint) {
								showText += I18N('HINT') + hint;
							}
						} catch (e) {}

						setProgress(showText, true);
					}
				}
				/**
				 * Submits a question with an answer to the database
				 * Отправляет вопрос с ответом в базу данных
				 */
				if (call.ident == callsIdent['quiz_answer']) {
					const answer = call.result.response;
					if (lastQuestion) {
						const answerInfo = {
							answer,
							question: lastQuestion,
							lang: null,
						};
						if (typeof NXFlashVars !== 'undefined') {
							answerInfo.lang = NXFlashVars.interface_lang;
						}
						lastQuestion = null;
						setTimeout(sendAnswerInfo, 0, answerInfo);
					}
				}
				/**
				 * Get user data
				 * Получить даныне пользователя
				 */
				if (call.ident == callsIdent['userGetInfo']) {
					let user = call.result.response;
					document.title = user.name;
					userInfo = Object.assign({}, user);
					delete userInfo.refillable;
					if (!questsInfo['userGetInfo']) {
						questsInfo['userGetInfo'] = user;
					}
				}
				/**
				 * Start of the battle for recalculation
				 * Начало боя для прерасчета
				 */
				if (call.ident == callsIdent['clanWarAttack'] ||
					call.ident == callsIdent['crossClanWar_startBattle'] ||
					call.ident == callsIdent['bossAttack'] ||
					call.ident == callsIdent['battleGetReplay'] ||
					call.ident == callsIdent['brawl_startBattle'] ||
					call.ident == callsIdent['adventureSolo_turnStartBattle'] ||
					call.ident == callsIdent['invasion_bossStart'] ||
					call.ident == callsIdent['titanArenaStartBattle'] ||
					call.ident == callsIdent['towerStartBattle'] ||
					call.ident == callsIdent['epicBrawl_startBattle'] ||
					call.ident == callsIdent['adventure_turnStartBattle']) {
					let battle = call.result.response.battle || call.result.response.replay;
					if (call.ident == callsIdent['brawl_startBattle'] ||
						call.ident == callsIdent['bossAttack'] ||
						call.ident == callsIdent['towerStartBattle'] ||
						call.ident == callsIdent['invasion_bossStart']) {
						battle = call.result.response;
					}
					lastBattleInfo = battle;
					if (call.ident == callsIdent['battleGetReplay'] && call.result.response.replay.type ===	"clan_raid") {
						if (call?.result?.response?.replay?.result?.damage) {
							const damages = Object.values(call.result.response.replay.result.damage);
							const bossDamage = damages.reduce((a, v) => a + v, 0);
							setProgress(I18N('BOSS_DAMAGE') + bossDamage.toLocaleString(), false, hideProgress);
							continue;
						}
					}
					if (!isChecked('preCalcBattle')) {
						continue;
					}
					const preCalcBattle = structuredClone(battle);
					setProgress(I18N('BEING_RECALC'));
					let battleDuration = 120;
					try {
						const typeBattle = getBattleType(preCalcBattle.type);
						battleDuration = +lib.data.battleConfig[typeBattle.split('_')[1]].config.battleDuration;
					} catch (e) { }
					//console.log(battle.type);
					function getBattleInfo(battle, isRandSeed) {
						return new Promise(function (resolve) {
							if (isRandSeed) {
								battle.seed = Math.floor(Date.now() / 1000) + random(0, 1e3);
							}
							BattleCalc(battle, getBattleType(battle.type), e => resolve(e));
						});
					}
					let actions = [getBattleInfo(preCalcBattle, false)];
					let countTestBattle = getInput('countTestBattle');
					if (call.ident == callsIdent['invasion_bossStart'] && preCalcBattle.seed === 8008) {
						countTestBattle = 0;
					}
					if (call.ident == callsIdent['battleGetReplay']) {
						preCalcBattle.progress = [{ attackers: { input: ['auto', 0, 0, 'auto', 0, 0] } }];
					}
					for (let i = 0; i < countTestBattle; i++) {
						actions.push(getBattleInfo(preCalcBattle, true));
					}
					Promise.all(actions)
						.then(e => {
							e = e.map(n => ({win: n.result.win, time: n.battleTime}));
							let firstBattle = e.shift();
							const timer = Math.floor(battleDuration - firstBattle.time);
							const min = ('00' + Math.floor(timer / 60)).slice(-2);
							const sec = ('00' + Math.floor(timer - min * 60)).slice(-2);
							let msg = `${I18N('THIS_TIME')} ${firstBattle.win ? I18N('VICTORY') : I18N('DEFEAT')}`;
							if (e.length) {
								const countWin = e.reduce((w, s) => w + s.win, 0);
								msg += ` ${I18N('CHANCE_TO_WIN')}: ${Math.floor((countWin / e.length) * 100)}% (${e.length})`;
							}
							msg += `, ${min}:${sec}`
							setProgress(msg, false, hideProgress)
						});
				}
				/**
				 * Start of the Asgard boss fight
				 * Начало боя с боссом Асгарда
				 */
				if (call.ident == callsIdent['clanRaid_startBossBattle']) {
					lastBossBattle = call.result.response.battle;
					lastBossBattle.endTime = Date.now() + 160 * 1000;
					if (isChecked('preCalcBattle')) {
						const result = await Calc(lastBossBattle).then(e => e.progress[0].defenders.heroes[1].extra);
						const bossDamage = result.damageTaken + result.damageTakenNextLevel;
						setProgress(I18N('BOSS_DAMAGE') + bossDamage.toLocaleString(), false, hideProgress);
					}
				}
				/**
				 * Cancel tutorial
				 * Отмена туториала
				 */
				if (isCanceledTutorial && call.ident == callsIdent['tutorialGetInfo']) {
					let chains = call.result.response.chains;
					for (let n in chains) {
						chains[n] = 9999;
					}
					isChange = true;
				}
				/**
				 * Opening keys and spheres of titan artifacts
				 * Открытие ключей и сфер артефактов титанов
				 */
				if (artifactChestOpen &&
					(call.ident == callsIdent[artifactChestOpenCallName] ||
						(callsIdent[artifactChestOpenCallName] && callsIdent[artifactChestOpenCallName].includes(call.ident)))) {
					let reward = call.result.response[artifactChestOpenCallName == 'artifactChestOpen' ? 'chestReward' : 'reward'];

					reward.forEach(e => {
						for (let f in e) {
							if (!allReward[f]) {
								allReward[f] = {};
							}
							for (let o in e[f]) {
								if (!allReward[f][o]) {
									allReward[f][o] = e[f][o];
									countTypeReward++;
								} else {
									allReward[f][o] += e[f][o];
								}
							}
						}
					});

					if (!call.ident.includes(artifactChestOpenCallName)) {
						mainReward = call.result.response;
					}
				}

				if (countTypeReward > 20) {
					correctShowOpenArtifact = 3;
				} else {
					correctShowOpenArtifact = 0;
				}

				/**
				 * Sum the result of opening Pet Eggs
				 * Суммирование результата открытия яиц питомцев
				 */
				if (isChecked('countControl') && call.ident == callsIdent['pet_chestOpen']) {
					const rewards = call.result.response.rewards;
					if (rewards.length > 10) {
						/**
						 * Removing pet cards
						 * Убираем карточки петов
						 */
						for (const reward of rewards) {
							if (reward.petCard) {
								delete reward.petCard;
							}
						}
					}
					rewards.forEach(e => {
						for (let f in e) {
							if (!allReward[f]) {
								allReward[f] = {};
							}
							for (let o in e[f]) {
								if (!allReward[f][o]) {
									allReward[f][o] = e[f][o];
								} else {
									allReward[f][o] += e[f][o];
								}
							}
						}
					});
					call.result.response.rewards = [allReward];
					isChange = true;
				}
				/**
				 * Removing titan cards
				 * Убираем карточки титанов
				 */
				if (call.ident == callsIdent['titanUseSummonCircle']) {
					if (call.result.response.rewards.length > 10) {
						for (const reward of call.result.response.rewards) {
							if (reward.titanCard) {
								delete reward.titanCard;
							}
						}
						isChange = true;
					}
				}
				/**
				 * Auto-repeat opening matryoshkas
				 * АвтоПовтор открытия матрешек
				 */
				if (isChecked('countControl') && call.ident == callsIdent['consumableUseLootBox']) {
					let [countLootBox, lootBox] = Object.entries(call.result.response).pop();
					countLootBox = +countLootBox;
					let newCount = 0;
					if (lootBox?.consumable && lootBox.consumable[lastRussianDollId]) {
						newCount += lootBox.consumable[lastRussianDollId];
						delete lootBox.consumable[lastRussianDollId];
					}
					if (
						newCount &&
						(await popup.confirm(`${I18N('BTN_OPEN')} ${newCount} ${I18N('OPEN_DOLLS')}?`, [
							{ msg: I18N('BTN_OPEN'), result: true },
							{ msg: I18N('BTN_NO'), result: false, isClose: true },
						]))
					) {
						const [count, recursionResult] = await openRussianDolls(lastRussianDollId, newCount);
						countLootBox += +count;
						mergeItemsObj(lootBox, recursionResult);
						isChange = true;
					}

					if (this.massOpen) {
						if (
							await popup.confirm(I18N('OPEN_ALL_EQUIP_BOXES'), [
								{ msg: I18N('BTN_OPEN'), result: true },
								{ msg: I18N('BTN_NO'), result: false, isClose: true },
							])
						) {
							const consumable = await Send({ calls: [{ name: 'inventoryGet', args: {}, ident: 'inventoryGet' }] }).then((e) =>
								Object.entries(e.results[0].result.response.consumable)
							);
							const calls = [];
							const deleteItems = {};
							for (const [libId, amount] of consumable) {
								if (libId != this.massOpen && libId >= 362 && libId <= 389) {
									calls.push({
										name: 'consumableUseLootBox',
										args: { libId, amount },
										ident: 'consumableUseLootBox_' + libId,
									});
									deleteItems[libId] = -amount;
								}
							}
							const responses = await Send({ calls }).then((e) => e.results.map((r) => r.result.response).flat());

							for (const loot of responses) {
								const [count, result] = Object.entries(loot).pop();
								countLootBox += +count;

								mergeItemsObj(lootBox, result);
							}
							isChange = true;

							this.onReadySuccess = () => {
								cheats.updateInventory({ consumable: deleteItems });
								cheats.refreshInventory();
							};
						}
					}

					if (isChange) {
						call.result.response = {
							[countLootBox]: lootBox,
						};
					}
				}
				/**
				 * Dungeon recalculation (fix endless cards)
				 * Прерасчет подземки (исправление бесконечных карт)
				 */
				if (call.ident == callsIdent['dungeonStartBattle']) {
					lastDungeonBattleData = call.result.response;
					lastDungeonBattleStart = Date.now();
				}
				/**
				 * Getting the number of prediction cards
				 * Получение количества карт предсказаний
				 */
				if (call.ident == callsIdent['inventoryGet']) {
					HWHData.countPredictionCard = call.result.response.consumable[81] || 0;
				}
				/**
				 * Getting subscription status
				 * Получение состояния подписки
				 */
				if (call.ident == callsIdent['subscriptionGetInfo']) {
					const subscription = call.result.response.subscription;
					if (subscription) {
						subEndTime = subscription.endTime * 1000;
					}
				}
				/**
				 * Getting prediction cards
				 * Получение карт предсказаний
				 */
				if (call.ident == callsIdent['questFarm']) {
					const consumable = call.result.response?.consumable;
					if (consumable && consumable[81]) {
						HWHData.countPredictionCard += consumable[81];
						console.log(`Cards: ${HWHData.countPredictionCard}`);
					}
				}
				/**
				 * Hiding extra servers
				 * Скрытие лишних серверов
				 */
				if (call.ident == callsIdent['serverGetAll'] && isChecked('hideServers')) {
					let servers = call.result.response.users.map(s => s.serverId)
					call.result.response.servers = call.result.response.servers.filter(s => servers.includes(s.id));
					isChange = true;
				}
				/**
				 * Displays player positions in the adventure
				 * Отображает позиции игроков в приключении
				 */
				if (call.ident == callsIdent['adventure_getLobbyInfo']) {
					const users = Object.values(call.result.response.users);
					const mapIdent = call.result.response.mapIdent;
					const adventureId = call.result.response.adventureId;
					const maps = {
						adv_strongford_3pl_hell: 9,
						adv_valley_3pl_hell: 10,
						adv_ghirwil_3pl_hell: 11,
						adv_angels_3pl_hell: 12,
					}
					let msg = I18N('MAP') + (mapIdent in maps ? maps[mapIdent] : adventureId);
					msg += '<br>' + I18N('PLAYER_POS');
					for (const user of users) {
						msg += `<br>${user.user.name} - ${user.currentNode}`;
					}
					setProgress(msg, false, hideProgress);
				}
				/**
				 * Automatic launch of a raid at the end of the adventure
				 * Автоматический запуск рейда при окончании приключения
				 */
				if (call.ident == callsIdent['adventure_end']) {
					autoRaidAdventure()
				}
				/** Удаление лавки редкостей */
				if (call.ident == callsIdent['missionRaid']) {
					if (call.result?.heroesMerchant) {
						delete call.result.heroesMerchant;
						isChange = true;
					}
				}
				/** missionTimer */
				if (call.ident == callsIdent['missionStart']) {
					missionBattle = call.result.response;
				}
				/** Награды турнира стихий */
				if (call.ident == callsIdent['hallOfFameGetTrophies']) {
					const trophys = call.result.response;
					const calls = [];
					for (const week in trophys) {
						const trophy = trophys[week];
						if (!trophy.championRewardFarmed) {
							calls.push({
								name: 'hallOfFameFarmTrophyReward',
								args: { trophyId: week, rewardType: 'champion' },
								ident: 'body_champion_' + week,
							});
						}
						if (Object.keys(trophy.clanReward).length && !trophy.clanRewardFarmed) {
							calls.push({
								name: 'hallOfFameFarmTrophyReward',
								args: { trophyId: week, rewardType: 'clan' },
								ident: 'body_clan_' + week,
							});
						}
					}
					if (calls.length) {
						Send({ calls })
							.then((e) => e.results.map((e) => e.result.response))
							.then(async results => {
								let coin18 = 0,
									coin19 = 0,
									gold = 0,
									starmoney = 0;
								for (const r of results) {
									coin18 += r?.coin ? +r.coin[18] : 0;
									coin19 += r?.coin ? +r.coin[19] : 0;
									gold += r?.gold ? +r.gold : 0;
									starmoney += r?.starmoney ? +r.starmoney : 0;
								}

								let msg = I18N('ELEMENT_TOURNAMENT_REWARD') + '<br>';
								if (coin18) {
									msg += cheats.translate('LIB_COIN_NAME_18') + `: ${coin18}<br>`;
								}
								if (coin19) {
									msg += cheats.translate('LIB_COIN_NAME_19') + `: ${coin19}<br>`;
								}
								if (gold) {
									msg += cheats.translate('LIB_PSEUDO_COIN') + `: ${gold}<br>`;
								}
								if (starmoney) {
									msg += cheats.translate('LIB_PSEUDO_STARMONEY') + `: ${starmoney}<br>`;
								}

								await popup.confirm(msg, [{ msg: I18N('BTN_OK'), result: 0 }]);
							});
					}
				}
				if (call.ident == callsIdent['clanDomination_getInfo']) {
					clanDominationGetInfo = call.result.response;
				}
				if (call.ident == callsIdent['clanRaid_endBossBattle']) {
					console.log(call.result.response);
					const damage = Object.values(call.result.response.damage).reduce((a, e) => a + e);
					if (call.result.response.result.afterInvalid) {
						addProgress('<br>' + I18N('SERVER_NOT_ACCEPT'));
					}
					addProgress('<br>Server > ' + I18N('BOSS_DAMAGE') + damage.toLocaleString());
				}
				if (call.ident == callsIdent['invasion_getInfo']) {
					const r = call.result.response;
					if (r?.actions?.length) {
						const { invasionInfo, invasionDataPacks } = HWHData;
						const boss = r.actions.find((e) => e.payload.id === invasionInfo.id);
						if (boss) {
							invasionInfo.buff = r.buffAmount;
							invasionInfo.bossLvl = boss.payload.level;
							if (isChecked('tryFixIt_v2')) {
								const pack = invasionDataPacks[invasionInfo.bossLvl];
								if (pack) {
									setProgress(
										I18N('INVASION_BOSS_BUFF', {
											bossLvl: invasionInfo.bossLvl,
											needBuff: pack.buff,
											haveBuff: invasionInfo.buff,
										}),
										false
									);
								}
							}
						}
					}
				}
				if (call.ident == callsIdent['workshopBuff_create']) {
					const r = call.result.response;
					if (r.id == 1) {
						const { invasionInfo, invasionDataPacks } = HWHData;
						invasionInfo.buff = r.amount;
						if (isChecked('tryFixIt_v2')) {
							const pack = invasionDataPacks[invasionInfo.bossLvl];
							if (pack) {
								setProgress(
									I18N('INVASION_BOSS_BUFF', {
										bossLvl: invasionInfo.bossLvl,
										needBuff: pack.buff,
										haveBuff: invasionInfo.buff,
									}),
									false
								);
							}
						}
					}
				}
				if (call.ident == callsIdent['mailFarm']) {
					const letters = Object.values(call.result.response);
					for (const letter of letters) {
						if (letter.consumable?.[81]) {
							console.log('Карты предсказаний', letter.consumable[81]);
							HWHData.countPredictionCard += letter.consumable[81];
						}
						if (letter.refillable?.[45]) {
							console.log('Сферы портала', letter.refillable[45]);
							setPortals(+letter.refillable[45], true);
						}
					}
				}
				if (call.ident == callsIdent['quest_questsFarm']) {
					const rewards = call.result.response;
					for (const reward of rewards) {
						if (reward.consumable?.[81]) {
							console.log('Карты предсказаний', reward.consumable[81]);
							HWHData.countPredictionCard += reward.consumable[81];
						}
						if (reward.refillable?.[45]) {
							console.log('Сферы портала', reward.refillable[45]);
							setPortals(+reward.refillable[45], true);
						}
					}
				}
				if (call.ident == callsIdent['adventure_start']) {
					setPortals(-1, true);
				}
				if (call.ident == callsIdent['clanWarEndBattle']) {
					setWarTries(-1, true);
				}
				if (call.ident == callsIdent['saleShowcase_rewardInfo']) {
					if (new Date(call.result.response.nextRefill * 1000) < Date.now()) {
						const offerId = this?.['saleShowcase_rewardInfo']?.offerId;
						if (offerId) {
							try {
								void Caller.send({ name: 'saleShowcase_farmReward', args: { offerId } });
							} catch (e) {
								console.error(e);
							}
						}
					}
				}
				/*
				if (call.ident == callsIdent['chatGetAll'] && call.args.chatType == 'clanDomination' && !callsIdent['clanDomination_mapState']) {
					this.onReadySuccess = async function () {
						const result = await Send({
							calls: [
								{
									name: 'clanDomination_mapState',
									args: {},
									ident: 'clanDomination_mapState',
								},
							],
						}).then((e) => e.results[0].result.response);
						let townPositions = result.townPositions;
						let positions = {};
						for (let pos in townPositions) {
							let townPosition = townPositions[pos];
							positions[townPosition.position] = townPosition;
						}
						Object.assign(clanDominationGetInfo, {
							townPositions: positions,
						});
						let userPositions = result.userPositions;
						for (let pos in clanDominationGetInfo.townPositions) {
							let townPosition = clanDominationGetInfo.townPositions[pos];
							if (townPosition.status) {
								userPositions[townPosition.userId] = +pos;
							}
						}
						cheats.updateMap(result);
					};
				}
				if (call.ident == callsIdent['clanDomination_mapState']) {
					const townPositions = call.result.response.townPositions;
					const userPositions = call.result.response.userPositions;
					for (let pos in townPositions) {
						let townPos = townPositions[pos];
						if (townPos.status) {
							userPositions[townPos.userId] = townPos.position;
						}
					}
					isChange = true;
				}
				*/
			}

			if (mainReward && artifactChestOpen) {
				console.log(allReward);
				mainReward[artifactChestOpenCallName == 'artifactChestOpen' ? 'chestReward' : 'reward'] = [allReward];
				artifactChestOpen = false;
				artifactChestOpenCallName = '';
				isChange = true;
			}
		} catch(err) {
			console.log("Request(response, " + this.uniqid + "):\n", "Error:\n", response, err);
		}

		if (isChange) {
			Object.defineProperty(this, 'responseText', {
				writable: true
			});
			this.responseText = JSON.stringify(respond);
		}
	}

	/**
	 * Request an answer to a question
	 *
	 * Запрос ответа на вопрос
	 */
	async function getAnswer(question) {
		// c29tZSBzdHJhbmdlIHN5bWJvbHM=
		const quizAPI = new ZingerYWebsiteAPI('getAnswer.php', arguments, { question });
			return new Promise((resolve, reject) => {
				quizAPI.request().then((data) => {
					if (data.result) {
						resolve(data.result);
					} else {
						resolve(false);
					}
				}).catch((error) => {
					console.error(error);
					resolve(false);
				});
			})
	}

	/**
	 * Submitting a question and answer to a database
	 *
	 * Отправка вопроса и ответа в базу данных
	 */
	function sendAnswerInfo(answerInfo) {
		// c29tZSBub25zZW5zZQ==
		const quizAPI = new ZingerYWebsiteAPI('setAnswer.php', arguments, { answerInfo });
		quizAPI.request().then((data) => {
			if (data.result) {
				console.log(I18N('SENT_QUESTION'));
			}
		});
	}

	/**
	 * Returns the battle type by preset type
	 *
	 * Возвращает тип боя по типу пресета
	 */
	function getBattleType(strBattleType) {
		if (!strBattleType) {
			return null;
		}
		switch (strBattleType) {
			case 'titan_pvp':
				return 'get_titanPvp';
			case 'titan_pvp_manual':
			case 'titan_clan_pvp':
			case 'clan_pvp_titan':
			case 'clan_global_pvp_titan':
			case 'brawl_titan':
			case 'challenge_titan':
			case 'titan_mission':
				return 'get_titanPvpManual';
			case 'clan_raid': // Asgard Boss // Босс асгарда
			case 'adventure': // Adventures // Приключения
			case 'clan_global_pvp':
			case 'epic_brawl':
			case 'clan_pvp':
				return 'get_clanPvp';
			case 'dungeon_titan':
			case 'titan_tower':
				return 'get_titan';
			case 'tower':
			case 'clan_dungeon':
				return 'get_tower';
			case 'pve':
			case 'mission':
				return 'get_pve';
			case 'mission_boss':
				return 'get_missionBoss';
			case 'challenge':
			case 'pvp_manual':
				return 'get_pvpManual';
			case 'grand':
			case 'arena':
			case 'pvp':
			case 'clan_domination':
				return 'get_pvp';
			case 'core':
				return 'get_core';
			default: {
				if (strBattleType.includes('invasion')) {
					return 'get_invasion';
				}
				if (strBattleType.includes('boss')) {
					return 'get_boss';
				}
				if (strBattleType.includes('titan_arena')) {
					return 'get_titanPvpManual';
				}
				return 'get_clanPvp';
			}
		}
	}
	/**
	 * Returns the class name of the passed object
	 *
	 * Возвращает название класса переданного объекта
	 */
	function getClass(obj) {
		return {}.toString.call(obj).slice(8, -1);
	}
	/**
	 * Calculates the request signature
	 *
	 * Расчитывает сигнатуру запроса
	 */
	this.getSignature = function(headers, data) {
		const sign = {
			signature: '',
			length: 0,
			add: function (text) {
				this.signature += text;
				if (this.length < this.signature.length) {
					this.length = 3 * (this.signature.length + 1) >> 1;
				}
			},
		}
		sign.add(headers["X-Request-Id"]);
		sign.add(':');
		sign.add(headers["X-Auth-Token"]);
		sign.add(':');
		sign.add(headers["X-Auth-Session-Id"]);
		sign.add(':');
		sign.add(data);
		sign.add(':');
		sign.add('LIBRARY-VERSION=1');
		sign.add('UNIQUE-SESSION-ID=' + headers["X-Env-Unique-Session-Id"]);

		return md5(sign.signature);
	}

	class HotkeyManager {
		constructor() {
			if (HotkeyManager.instance) {
				return HotkeyManager.instance;
			}
			this.hotkeys = [];
			document.addEventListener('keydown', this.handleKeyDown.bind(this));
			HotkeyManager.instance = this;
		}

		handleKeyDown(event) {
			if (!event.key) {
				return;
			}
			const key = event.key.toLowerCase();
			const mods = {
				ctrl: event.ctrlKey,
				alt: event.altKey,
				shift: event.shiftKey,
			};

			this.hotkeys.forEach((hotkey) => {
				if (hotkey.key === key && hotkey.ctrl === mods.ctrl && hotkey.alt === mods.alt && hotkey.shift === mods.shift) {
					hotkey.callback(hotkey);
				}
			});
		}

		add(key, opt = {}, callback) {
			this.hotkeys.push({
				key: key.toLowerCase(),
				callback,
				ctrl: opt.ctrl || false,
				alt: opt.alt || false,
				shift: opt.shift || false,
			});
		}

		remove(key, opt = {}) {
			this.hotkeys = this.hotkeys.filter((hotkey) => {
				return !(
					hotkey.key === key.toLowerCase() &&
					hotkey.ctrl === (opt.ctrl || false) &&
					hotkey.alt === (opt.alt || false) &&
					hotkey.shift === (opt.shift || false)
				);
			});
		}

		static getInst() {
			if (!HotkeyManager.instance) {
				new HotkeyManager();
			}
			return HotkeyManager.instance;
		}
	}

	class MouseClicker {
		constructor(element) {
			if (MouseClicker.instance) {
				return MouseClicker.instance;
			}
			this.element = element;
			this.mouse = {
				bubbles: true,
				cancelable: true,
				clientX: 0,
				clientY: 0,
			};
			this.element.addEventListener('mousemove', this.handleMouseMove.bind(this));
			this.clickInfo = {};
			this.nextTimeoutId = 1;
			MouseClicker.instance = this;
		}

		handleMouseMove(event) {
			this.mouse.clientX = event.clientX;
			this.mouse.clientY = event.clientY;
		}

		click(options) {
			options = options || this.mouse;
			this.element.dispatchEvent(new MouseEvent('mousedown', options));
			this.element.dispatchEvent(new MouseEvent('mouseup', options));
		}

		start(interval = 1000, clickCount = Infinity) {
			const currentMouse = { ...this.mouse };
			const timeoutId = this.nextTimeoutId++;
			let count = 0;

			const clickTimeout = () => {
				this.click(currentMouse);
				count++;
				if (count < clickCount) {
					this.clickInfo[timeoutId].timeout = setTimeout(clickTimeout, interval);
				} else {
					delete this.clickInfo[timeoutId];
				}
			};

			this.clickInfo[timeoutId] = {
				timeout: setTimeout(clickTimeout, interval),
				count: clickCount,
			};
			return timeoutId;
		}

		stop(timeoutId) {
			if (this.clickInfo[timeoutId]) {
				clearTimeout(this.clickInfo[timeoutId].timeout);
				delete this.clickInfo[timeoutId];
			}
		}

		stopAll() {
			for (const timeoutId in this.clickInfo) {
				clearTimeout(this.clickInfo[timeoutId].timeout);
			}
			this.clickInfo = {};
		}

		static getInst(element) {
			if (!MouseClicker.instance) {
				new MouseClicker(element);
			}
			return MouseClicker.instance;
		}
	}

	let extintionsList = [];
	/**
	 * Creates an interface
	 *
	 * Создает интерфейс
	 */
	function createInterface() {
		popup.init();
		const { ScriptMenu } = HWHClasses;
		const scriptMenu = ScriptMenu.getInst();
		scriptMenu.init();
		scriptMenu.addHeader(GM_info.script.name, justInfo);
		const versionHeader = scriptMenu.addHeader('v' + GM_info.script.version);
		if (extintionsList.length) {
			versionHeader.title = '';
			versionHeader.style.color = 'red';
			for (const extintion of extintionsList) {
				const { name, ver, author } = extintion;
				versionHeader.title += name + ', v' + ver + ' by ' + author + '\n';
			}
			versionHeader.innerText += ` [${extintionsList.length}]`;
		}
		// AutoClicker
		const hkm = new HotkeyManager();
		const fc = document.getElementById('flash-content') || document.getElementById('game');
		const mc = new MouseClicker(fc);
		function toggleClicker(self, timeout) {
			if (self.onClick) {
				console.log('Останавливаем клики');
				mc.stop(self.onClick);
				self.onClick = false;
			} else {
				console.log('Стартуем клики');
				self.onClick = mc.start(timeout);
			}
		}
		hkm.add('C', { ctrl: true, alt: true }, (self) => {
			console.log('"Ctrl + Alt + C"');
			toggleClicker(self, 20);
		});
		hkm.add('V', { ctrl: true, alt: true }, (self) => {
			console.log('"Ctrl + Alt + V"');
			toggleClicker(self, 100);
		});
	}

	function addExtentionName(name, ver, author) {
		extintionsList.push({
			name,
			ver,
			author,
		});
	}

	function addControls() {
		createInterface();
		const { ScriptMenu } = HWHClasses;
		const scriptMenu = ScriptMenu.getInst();
		const checkboxDetails = scriptMenu.addDetails(I18N('SETTINGS'), 'settings');
		const { checkboxes } = HWHData;
		for (let name in checkboxes) {
			if (checkboxes[name].hide) {
				continue;
			}
			checkboxes[name].cbox = scriptMenu.addCheckbox(checkboxes[name].label, checkboxes[name].title, checkboxDetails);
			/**
			 * Getting the state of checkboxes from storage
			 * Получаем состояние чекбоксов из storage
			 */
			let val = storage.get(name, null);
			if (val != null) {
				checkboxes[name].cbox.checked = val;
			} else {
				storage.set(name, checkboxes[name].default);
				checkboxes[name].cbox.checked = checkboxes[name].default;
			}
			/**
			 * Tracing the change event of the checkbox for writing to storage
			 * Отсеживание события изменения чекбокса для записи в storage
			 */
			checkboxes[name].cbox.dataset['name'] = name;
			checkboxes[name].cbox.addEventListener('change', async function (event) {
				const nameCheckbox = this.dataset['name'];
				/*
				if (this.checked && nameCheckbox == 'cancelBattle') {
					this.checked = false;
					if (await popup.confirm(I18N('MSG_BAN_ATTENTION'), [
						{ msg: I18N('BTN_NO_I_AM_AGAINST'), result: true },
						{ msg: I18N('BTN_YES_I_AGREE'), result: false },
					])) {
						return;
					}
					this.checked = true;
				}
				*/
				storage.set(nameCheckbox, this.checked);
			})
		}

		const inputDetails = scriptMenu.addDetails(I18N('VALUES'), 'values');
		const { inputs } = HWHData;
		for (let name in inputs) {
			inputs[name].input = scriptMenu.addInputText(inputs[name].title, false, inputDetails);
			/**
			 * Get inputText state from storage
			 * Получаем состояние inputText из storage
			 */
			let val = storage.get(name, null);
			if (val != null) {
				inputs[name].input.value = val;
			} else {
				storage.set(name, inputs[name].default);
				inputs[name].input.value = inputs[name].default;
			}
			/**
			 * Tracing a field change event for a record in storage
			 * Отсеживание события изменения поля для записи в storage
			 */
			inputs[name].input.dataset['name'] = name;
			inputs[name].input.addEventListener('input', function () {
				const inputName = this.dataset['name'];
				let value = +this.value;
				if (!value || Number.isNaN(value)) {
					value = storage.get(inputName, inputs[inputName].default);
					inputs[name].input.value = value;
				}
				storage.set(inputName, value);
			})
		}
	}

	/**
	 * Sending a request
	 *
	 * Отправка запроса
	 */
	function send(json, callback, pr) {
		if (typeof json == 'string') {
			json = JSON.parse(json);
		}
		for (const call of json.calls) {
			if (!call?.context?.actionTs) {
				call.context = {
					actionTs: Math.floor(performance.now())
				}
			}
		}
		json = JSON.stringify(json);
		/**
		 * We get the headlines of the previous intercepted request
		 * Получаем заголовки предыдущего перехваченого запроса
		 */
		let headers = lastHeaders;
		/**
		 * We increase the header of the query Certifier by 1
		 * Увеличиваем заголовок идетификатора запроса на 1
		 */
		headers["X-Request-Id"]++;
		/**
		 * We calculate the title with the signature
		 * Расчитываем заголовок с сигнатурой
		 */
		headers["X-Auth-Signature"] = getSignature(headers, json);
		/**
		 * Create a new ajax request
		 * Создаем новый AJAX запрос
		 */
		let xhr = new XMLHttpRequest;
		/**
		 * Indicate the previously saved URL for API queries
		 * Указываем ранее сохраненный URL для API запросов
		 */
		xhr.open('POST', apiUrl, true);
		/**
		 * Add the function to the event change event
		 * Добавляем функцию к событию смены статуса запроса
		 */
		xhr.onreadystatechange = function() {
			/**
			 * If the result of the request is obtained, we call the flask function
			 * Если результат запроса получен вызываем колбек функцию
			 */
			if(xhr.readyState == 4) {
				callback(xhr.response, pr);
			}
		};
		/**
		 * Indicate the type of request
		 * Указываем тип запроса
		 */
		xhr.responseType = 'json';
		/**
		 * We set the request headers
		 * Задаем заголовки запроса
		 */
		for(let nameHeader in headers) {
			let head = headers[nameHeader];
			xhr.setRequestHeader(nameHeader, head);
		}
		/**
		 * Sending a request
		 * Отправляем запрос
		 */
		xhr.send(json);
	}

	let hideTimeoutProgress = 0;
	/**
	 * Hide progress
	 *
	 * Скрыть прогресс
	 */
	function hideProgress(timeout) {
		const { ScriptMenu } = HWHClasses;
		const scriptMenu = ScriptMenu.getInst();
		timeout = timeout || 0;
		clearTimeout(hideTimeoutProgress);
		hideTimeoutProgress = setTimeout(function () {
			scriptMenu.setStatus('');
		}, timeout);
	}
	/**
	 * Progress display
	 *
	 * Отображение прогресса
	 */
	function setProgress(text, hide, onclick) {
		const { ScriptMenu } = HWHClasses;
		const scriptMenu = ScriptMenu.getInst();
		scriptMenu.setStatus(text, onclick);
		hide = hide || false;
		if (hide) {
			hideProgress(3000);
		}
	}

	/**
	 * Progress added
	 *
	 * Дополнение прогресса
	 */
	function addProgress(text) {
		const { ScriptMenu } = HWHClasses;
		const scriptMenu = ScriptMenu.getInst();
		scriptMenu.addStatus(text);
	}

	/**
	 * Returns the timer value depending on the subscription
	 *
	 * Возвращает значение таймера в зависимости от подписки
	 */
	function getTimer(time, div) {
		let speedDiv = 5;
		if (subEndTime < Date.now()) {
			speedDiv = div || 1.5;
		}
		return Math.max(Math.ceil(time / speedDiv + 1.5), 4);
	}

	function startSlave() {
		const { slaveFixBattle } = HWHClasses;
		const sFix = new slaveFixBattle();
		sFix.wsStart();
	}

	this.testFuntions = {
		hideProgress,
		setProgress,
		addProgress,
		masterFix: false,
		startSlave,
	};

	this.HWHFuncs = {
		send,
		I18N,
		isChecked,
		getInput,
		copyText,
		confShow,
		hideProgress,
		setProgress,
		addProgress,
		getTimer,
		addExtentionName,
		getUserInfo,
		setIsCancalBattle,
		random,
	};

	this.HWHClasses = {
		checkChangeSend,
		checkChangeResponse,
	};

	this.HWHData = {
		i18nLangData,
		checkboxes,
		inputs,
		buttons,
		invasionInfo,
		invasionDataPacks,
		countPredictionCard,
		actionsPopupButtons,
		othersPopupButtons,
	};

	/**
	 * Calculates HASH MD5 from string
	 *
	 * Расчитывает HASH MD5 из строки
	 *
	 * [js-md5]{@link https://github.com/emn178/js-md5}
	 *
	 * @namespace md5
	 * @version 0.7.3
	 * @author Chen, Yi-Cyuan [emn178@gmail.com]
	 * @copyright Chen, Yi-Cyuan 2014-2017
	 * @license MIT
	 */
	!function(){"use strict";function t(t){if(t)d[0]=d[16]=d[1]=d[2]=d[3]=d[4]=d[5]=d[6]=d[7]=d[8]=d[9]=d[10]=d[11]=d[12]=d[13]=d[14]=d[15]=0,this.blocks=d,this.buffer8=l;else if(a){var r=new ArrayBuffer(68);this.buffer8=new Uint8Array(r),this.blocks=new Uint32Array(r)}else this.blocks=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];this.h0=this.h1=this.h2=this.h3=this.start=this.bytes=this.hBytes=0,this.finalized=this.hashed=!1,this.first=!0}var r="input is invalid type",e="object"==typeof window,i=e?window:{};i.JS_MD5_NO_WINDOW&&(e=!1);var s=!e&&"object"==typeof self,h=!i.JS_MD5_NO_NODE_JS&&"object"==typeof process&&process.versions&&process.versions.node;h?i=global:s&&(i=self);var f=!i.JS_MD5_NO_COMMON_JS&&"object"==typeof module&&module.exports,o="function"==typeof define&&define.amd,a=!i.JS_MD5_NO_ARRAY_BUFFER&&"undefined"!=typeof ArrayBuffer,n="0123456789abcdef".split(""),u=[128,32768,8388608,-2147483648],y=[0,8,16,24],c=["hex","array","digest","buffer","arrayBuffer","base64"],p="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split(""),d=[],l;if(a){var A=new ArrayBuffer(68);l=new Uint8Array(A),d=new Uint32Array(A)}!i.JS_MD5_NO_NODE_JS&&Array.isArray||(Array.isArray=function(t){return"[object Array]"===Object.prototype.toString.call(t)}),!a||!i.JS_MD5_NO_ARRAY_BUFFER_IS_VIEW&&ArrayBuffer.isView||(ArrayBuffer.isView=function(t){return"object"==typeof t&&t.buffer&&t.buffer.constructor===ArrayBuffer});var b=function(r){return function(e){return new t(!0).update(e)[r]()}},v=function(){var r=b("hex");h&&(r=w(r)),r.create=function(){return new t},r.update=function(t){return r.create().update(t)};for(var e=0;e<c.length;++e){var i=c[e];r[i]=b(i)}return r},w=function(t){var e=eval("require('crypto')"),i=eval("require('buffer').Buffer"),s=function(s){if("string"==typeof s)return e.createHash("md5").update(s,"utf8").digest("hex");if(null===s||void 0===s)throw r;return s.constructor===ArrayBuffer&&(s=new Uint8Array(s)),Array.isArray(s)||ArrayBuffer.isView(s)||s.constructor===i?e.createHash("md5").update(new i(s)).digest("hex"):t(s)};return s};t.prototype.update=function(t){if(!this.finalized){var e,i=typeof t;if("string"!==i){if("object"!==i)throw r;if(null===t)throw r;if(a&&t.constructor===ArrayBuffer)t=new Uint8Array(t);else if(!(Array.isArray(t)||a&&ArrayBuffer.isView(t)))throw r;e=!0}for(var s,h,f=0,o=t.length,n=this.blocks,u=this.buffer8;f<o;){if(this.hashed&&(this.hashed=!1,n[0]=n[16],n[16]=n[1]=n[2]=n[3]=n[4]=n[5]=n[6]=n[7]=n[8]=n[9]=n[10]=n[11]=n[12]=n[13]=n[14]=n[15]=0),e)if(a)for(h=this.start;f<o&&h<64;++f)u[h++]=t[f];else for(h=this.start;f<o&&h<64;++f)n[h>>2]|=t[f]<<y[3&h++];else if(a)for(h=this.start;f<o&&h<64;++f)(s=t.charCodeAt(f))<128?u[h++]=s:s<2048?(u[h++]=192|s>>6,u[h++]=128|63&s):s<55296||s>=57344?(u[h++]=224|s>>12,u[h++]=128|s>>6&63,u[h++]=128|63&s):(s=65536+((1023&s)<<10|1023&t.charCodeAt(++f)),u[h++]=240|s>>18,u[h++]=128|s>>12&63,u[h++]=128|s>>6&63,u[h++]=128|63&s);else for(h=this.start;f<o&&h<64;++f)(s=t.charCodeAt(f))<128?n[h>>2]|=s<<y[3&h++]:s<2048?(n[h>>2]|=(192|s>>6)<<y[3&h++],n[h>>2]|=(128|63&s)<<y[3&h++]):s<55296||s>=57344?(n[h>>2]|=(224|s>>12)<<y[3&h++],n[h>>2]|=(128|s>>6&63)<<y[3&h++],n[h>>2]|=(128|63&s)<<y[3&h++]):(s=65536+((1023&s)<<10|1023&t.charCodeAt(++f)),n[h>>2]|=(240|s>>18)<<y[3&h++],n[h>>2]|=(128|s>>12&63)<<y[3&h++],n[h>>2]|=(128|s>>6&63)<<y[3&h++],n[h>>2]|=(128|63&s)<<y[3&h++]);this.lastByteIndex=h,this.bytes+=h-this.start,h>=64?(this.start=h-64,this.hash(),this.hashed=!0):this.start=h}return this.bytes>4294967295&&(this.hBytes+=this.bytes/4294967296<<0,this.bytes=this.bytes%4294967296),this}},t.prototype.finalize=function(){if(!this.finalized){this.finalized=!0;var t=this.blocks,r=this.lastByteIndex;t[r>>2]|=u[3&r],r>=56&&(this.hashed||this.hash(),t[0]=t[16],t[16]=t[1]=t[2]=t[3]=t[4]=t[5]=t[6]=t[7]=t[8]=t[9]=t[10]=t[11]=t[12]=t[13]=t[14]=t[15]=0),t[14]=this.bytes<<3,t[15]=this.hBytes<<3|this.bytes>>>29,this.hash()}},t.prototype.hash=function(){var t,r,e,i,s,h,f=this.blocks;this.first?r=((r=((t=((t=f[0]-680876937)<<7|t>>>25)-271733879<<0)^(e=((e=(-271733879^(i=((i=(-1732584194^2004318071&t)+f[1]-117830708)<<12|i>>>20)+t<<0)&(-271733879^t))+f[2]-1126478375)<<17|e>>>15)+i<<0)&(i^t))+f[3]-1316259209)<<22|r>>>10)+e<<0:(t=this.h0,r=this.h1,e=this.h2,r=((r+=((t=((t+=((i=this.h3)^r&(e^i))+f[0]-680876936)<<7|t>>>25)+r<<0)^(e=((e+=(r^(i=((i+=(e^t&(r^e))+f[1]-389564586)<<12|i>>>20)+t<<0)&(t^r))+f[2]+606105819)<<17|e>>>15)+i<<0)&(i^t))+f[3]-1044525330)<<22|r>>>10)+e<<0),r=((r+=((t=((t+=(i^r&(e^i))+f[4]-176418897)<<7|t>>>25)+r<<0)^(e=((e+=(r^(i=((i+=(e^t&(r^e))+f[5]+1200080426)<<12|i>>>20)+t<<0)&(t^r))+f[6]-1473231341)<<17|e>>>15)+i<<0)&(i^t))+f[7]-45705983)<<22|r>>>10)+e<<0,r=((r+=((t=((t+=(i^r&(e^i))+f[8]+1770035416)<<7|t>>>25)+r<<0)^(e=((e+=(r^(i=((i+=(e^t&(r^e))+f[9]-1958414417)<<12|i>>>20)+t<<0)&(t^r))+f[10]-42063)<<17|e>>>15)+i<<0)&(i^t))+f[11]-1990404162)<<22|r>>>10)+e<<0,r=((r+=((t=((t+=(i^r&(e^i))+f[12]+1804603682)<<7|t>>>25)+r<<0)^(e=((e+=(r^(i=((i+=(e^t&(r^e))+f[13]-40341101)<<12|i>>>20)+t<<0)&(t^r))+f[14]-1502002290)<<17|e>>>15)+i<<0)&(i^t))+f[15]+1236535329)<<22|r>>>10)+e<<0,r=((r+=((i=((i+=(r^e&((t=((t+=(e^i&(r^e))+f[1]-165796510)<<5|t>>>27)+r<<0)^r))+f[6]-1069501632)<<9|i>>>23)+t<<0)^t&((e=((e+=(t^r&(i^t))+f[11]+643717713)<<14|e>>>18)+i<<0)^i))+f[0]-373897302)<<20|r>>>12)+e<<0,r=((r+=((i=((i+=(r^e&((t=((t+=(e^i&(r^e))+f[5]-701558691)<<5|t>>>27)+r<<0)^r))+f[10]+38016083)<<9|i>>>23)+t<<0)^t&((e=((e+=(t^r&(i^t))+f[15]-660478335)<<14|e>>>18)+i<<0)^i))+f[4]-405537848)<<20|r>>>12)+e<<0,r=((r+=((i=((i+=(r^e&((t=((t+=(e^i&(r^e))+f[9]+568446438)<<5|t>>>27)+r<<0)^r))+f[14]-1019803690)<<9|i>>>23)+t<<0)^t&((e=((e+=(t^r&(i^t))+f[3]-187363961)<<14|e>>>18)+i<<0)^i))+f[8]+1163531501)<<20|r>>>12)+e<<0,r=((r+=((i=((i+=(r^e&((t=((t+=(e^i&(r^e))+f[13]-1444681467)<<5|t>>>27)+r<<0)^r))+f[2]-51403784)<<9|i>>>23)+t<<0)^t&((e=((e+=(t^r&(i^t))+f[7]+1735328473)<<14|e>>>18)+i<<0)^i))+f[12]-1926607734)<<20|r>>>12)+e<<0,r=((r+=((h=(i=((i+=((s=r^e)^(t=((t+=(s^i)+f[5]-378558)<<4|t>>>28)+r<<0))+f[8]-2022574463)<<11|i>>>21)+t<<0)^t)^(e=((e+=(h^r)+f[11]+1839030562)<<16|e>>>16)+i<<0))+f[14]-35309556)<<23|r>>>9)+e<<0,r=((r+=((h=(i=((i+=((s=r^e)^(t=((t+=(s^i)+f[1]-1530992060)<<4|t>>>28)+r<<0))+f[4]+1272893353)<<11|i>>>21)+t<<0)^t)^(e=((e+=(h^r)+f[7]-155497632)<<16|e>>>16)+i<<0))+f[10]-1094730640)<<23|r>>>9)+e<<0,r=((r+=((h=(i=((i+=((s=r^e)^(t=((t+=(s^i)+f[13]+681279174)<<4|t>>>28)+r<<0))+f[0]-358537222)<<11|i>>>21)+t<<0)^t)^(e=((e+=(h^r)+f[3]-722521979)<<16|e>>>16)+i<<0))+f[6]+76029189)<<23|r>>>9)+e<<0,r=((r+=((h=(i=((i+=((s=r^e)^(t=((t+=(s^i)+f[9]-640364487)<<4|t>>>28)+r<<0))+f[12]-421815835)<<11|i>>>21)+t<<0)^t)^(e=((e+=(h^r)+f[15]+530742520)<<16|e>>>16)+i<<0))+f[2]-995338651)<<23|r>>>9)+e<<0,r=((r+=((i=((i+=(r^((t=((t+=(e^(r|~i))+f[0]-198630844)<<6|t>>>26)+r<<0)|~e))+f[7]+1126891415)<<10|i>>>22)+t<<0)^((e=((e+=(t^(i|~r))+f[14]-1416354905)<<15|e>>>17)+i<<0)|~t))+f[5]-57434055)<<21|r>>>11)+e<<0,r=((r+=((i=((i+=(r^((t=((t+=(e^(r|~i))+f[12]+1700485571)<<6|t>>>26)+r<<0)|~e))+f[3]-1894986606)<<10|i>>>22)+t<<0)^((e=((e+=(t^(i|~r))+f[10]-1051523)<<15|e>>>17)+i<<0)|~t))+f[1]-2054922799)<<21|r>>>11)+e<<0,r=((r+=((i=((i+=(r^((t=((t+=(e^(r|~i))+f[8]+1873313359)<<6|t>>>26)+r<<0)|~e))+f[15]-30611744)<<10|i>>>22)+t<<0)^((e=((e+=(t^(i|~r))+f[6]-1560198380)<<15|e>>>17)+i<<0)|~t))+f[13]+1309151649)<<21|r>>>11)+e<<0,r=((r+=((i=((i+=(r^((t=((t+=(e^(r|~i))+f[4]-145523070)<<6|t>>>26)+r<<0)|~e))+f[11]-1120210379)<<10|i>>>22)+t<<0)^((e=((e+=(t^(i|~r))+f[2]+718787259)<<15|e>>>17)+i<<0)|~t))+f[9]-343485551)<<21|r>>>11)+e<<0,this.first?(this.h0=t+1732584193<<0,this.h1=r-271733879<<0,this.h2=e-1732584194<<0,this.h3=i+271733878<<0,this.first=!1):(this.h0=this.h0+t<<0,this.h1=this.h1+r<<0,this.h2=this.h2+e<<0,this.h3=this.h3+i<<0)},t.prototype.hex=function(){this.finalize();var t=this.h0,r=this.h1,e=this.h2,i=this.h3;return n[t>>4&15]+n[15&t]+n[t>>12&15]+n[t>>8&15]+n[t>>20&15]+n[t>>16&15]+n[t>>28&15]+n[t>>24&15]+n[r>>4&15]+n[15&r]+n[r>>12&15]+n[r>>8&15]+n[r>>20&15]+n[r>>16&15]+n[r>>28&15]+n[r>>24&15]+n[e>>4&15]+n[15&e]+n[e>>12&15]+n[e>>8&15]+n[e>>20&15]+n[e>>16&15]+n[e>>28&15]+n[e>>24&15]+n[i>>4&15]+n[15&i]+n[i>>12&15]+n[i>>8&15]+n[i>>20&15]+n[i>>16&15]+n[i>>28&15]+n[i>>24&15]},t.prototype.toString=t.prototype.hex,t.prototype.digest=function(){this.finalize();var t=this.h0,r=this.h1,e=this.h2,i=this.h3;return[255&t,t>>8&255,t>>16&255,t>>24&255,255&r,r>>8&255,r>>16&255,r>>24&255,255&e,e>>8&255,e>>16&255,e>>24&255,255&i,i>>8&255,i>>16&255,i>>24&255]},t.prototype.array=t.prototype.digest,t.prototype.arrayBuffer=function(){this.finalize();var t=new ArrayBuffer(16),r=new Uint32Array(t);return r[0]=this.h0,r[1]=this.h1,r[2]=this.h2,r[3]=this.h3,t},t.prototype.buffer=t.prototype.arrayBuffer,t.prototype.base64=function(){for(var t,r,e,i="",s=this.array(),h=0;h<15;)t=s[h++],r=s[h++],e=s[h++],i+=p[t>>>2]+p[63&(t<<4|r>>>4)]+p[63&(r<<2|e>>>6)]+p[63&e];return t=s[h],i+=p[t>>>2]+p[t<<4&63]+"=="};var _=v();f?module.exports=_:(i.md5=_,o&&define(function(){return _}))}();

	class Caller {
		static globalHooks = {
			onError: null,
		};

		constructor(calls = null) {
			this.calls = [];
			this.results = {};
			this.sideResults = {};
			if (calls) {
				this.add(calls);
			}
		}

		static setGlobalHook(event, callback) {
			if (this.globalHooks[event] !== undefined) {
				this.globalHooks[event] = callback;
			} else {
				throw new Error(`Unknown event: ${event}`);
			}
		}

		addCall(call) {
			const { name = call, args = {} } = typeof call === 'object' ? call : { name: call };
			this.calls.push({ name, args });
			return this;
		}

		add(name) {
			if (Array.isArray(name)) {
				name.forEach((call) => this.addCall(call));
			} else {
				this.addCall(name);
			}
			return this;
		}

		handleError(error) {
			const errorName = error.name;
			const errorDescription = error.description;

			if (Caller.globalHooks.onError) {
				const shouldThrow = Caller.globalHooks.onError(error);
				if (shouldThrow === false) {
					return;
				}
			}

			if (error.call) {
				const callInfo = error.call;
				throw new Error(`${errorName} in ${callInfo.name}: ${errorDescription}\n` + `Args: ${JSON.stringify(callInfo.args)}\n`);
			} else if (errorName === 'common\\rpc\\exception\\InvalidRequest') {
				throw new Error(`Invalid request: ${errorDescription}`);
			} else {
				throw new Error(`Unknown error: ${errorName} - ${errorDescription}`);
			}
		}

		async send() {
			if (!this.calls.length) {
				throw new Error('No calls to send.');
			}

			const identToNameMap = {};
			const callsWithIdent = this.calls.map((call, index) => {
				const ident = this.calls.length === 1 ? 'body' : `group_${index}_body`;
				identToNameMap[ident] = call.name;
				return { ...call, ident };
			});

			try {
				const response = await Send({ calls: callsWithIdent });

				if (response.error) {
					this.handleError(response.error);
				}

				if (!response.results) {
					throw new Error('Invalid response format: missing "results" field');
				}

				response.results.forEach((result) => {
					const name = identToNameMap[result.ident];
					if (!this.results[name]) {
						this.results[name] = [];
						this.sideResults[name] = [];
					}
					this.results[name].push(result.result.response);
					const sideResults = {};
					for (const key of Object.keys(result.result)) {
						if (key === 'response') continue;
						sideResults[key] = result.result[key];
					}
					this.sideResults[name].push(sideResults);
				});
			} catch (error) {
				throw error;
			}
			return this;
		}

		result(name, forceArray = false) {
			const results = name ? this.results[name] || [] : Object.values(this.results).flat();
			return forceArray || results.length !== 1 ? results : results[0];
		}

		sideResult(name, forceArray = false) {
			const results = name ? this.sideResults[name] || [] : Object.values(this.sideResults).flat();
			return forceArray || results.length !== 1 ? results : results[0];
		}

		async execute(name) {
			try {
				await this.send();
				return this.result(name);
			} catch (error) {
				throw error;
			}
		}

		clear() {
			this.calls = [];
			this.results = {};
			return this;
		}

		isEmpty() {
			return this.calls.length === 0 && Object.keys(this.results).length === 0;
		}

		static async send(calls) {
			return new Caller(calls).execute();
		}
	}

	this.Caller = Caller;

	/*
	// Примеры использования
	(async () => {
		// Короткий вызов
		await new Caller('inventoryGet').execute();
		// Простой вызов
		let result = await new Caller().add('inventoryGet').execute();
		console.log('Inventory Get Result:', result);

		// Сложный вызов
		let caller = new Caller();
		await caller
			.add([
				{
					name: 'inventoryGet',
					args: {},
				},
				{
					name: 'heroGetAll',
					args: {},
				},
			])
			.send();
		console.log('Inventory Get Result:', caller.result('inventoryGet'));
		console.log('Hero Get All Result:', caller.result('heroGetAll'));

		// Очистка всех данных
		caller.clear();
	})();
	*/

	/**
	 * Script for beautiful dialog boxes
	 *
	 * Скрипт для красивых диалоговых окошек
	 */
	const popup = new (function () {
		this.popUp, this.downer, this.custom, this.middle, this.msgText, (this.buttons = []);
		this.checkboxes = [];
		this.dialogPromice = null;
		this.isInit = false;

		this.init = function () {
			if (this.isInit) {
				return;
			}
			addStyle();
			addBlocks();
			addEventListeners();
			this.isInit = true;
		}

		const addEventListeners = () => {
			document.addEventListener('keyup', (e) => {
				if (e.key == 'Escape') {
					if (this.dialogPromice) {
						const { func, result } = this.dialogPromice;
						this.dialogPromice = null;
						popup.hide();
						func(result);
					}
				}
			});
		}

		const addStyle = () => {
			let style = document.createElement('style');
			style.innerText = `
		.PopUp_ {
			 position: fixed;
			left: 50%;
			top: 50%;
			transform: translate(-50%, -50%);
			min-width: 300px;
			max-width: 80%;
			max-height: 80%;
			background-color: #190e08e6;
			z-index: 10001;
			border: 3px #ce9767 solid;
			border-radius: 10px;
			display: flex;
			flex-direction: column;
			justify-content: space-around;
			padding: 15px 9px;
			box-sizing: border-box;
		}

		.PopUp_back {
			position: absolute;
			background-color: #00000066;
			width: 100%;
			height: 100%;
			z-index: 10000;
			top: 0;
			left: 0;
		}

		.PopUp_close {
			width: 40px;
			height: 40px;
			position: absolute;
			right: -18px;
			top: -18px;
			border: 3px solid #c18550;
			border-radius: 20px;
			background: radial-gradient(circle, rgba(190,30,35,1) 0%, rgba(0,0,0,1) 100%);
			background-position-y: 3px;
			box-shadow: -1px 1px 3px black;
			cursor: pointer;
			box-sizing: border-box;
		}

		.PopUp_close:hover {
			filter: brightness(1.2);
		}

		.PopUp_crossClose {
			width: 100%;
			height: 100%;
			background-size: 65%;
			background-position: center;
			background-repeat: no-repeat;
			background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='%23f4cd73' d='M 0.826 12.559 C 0.431 12.963 3.346 15.374 3.74 14.97 C 4.215 15.173 8.167 10.457 7.804 10.302 C 7.893 10.376 11.454 14.64 11.525 14.372 C 12.134 15.042 15.118 12.086 14.638 11.689 C 14.416 11.21 10.263 7.477 10.402 7.832 C 10.358 7.815 11.731 7.101 14.872 3.114 C 14.698 2.145 13.024 1.074 12.093 1.019 C 11.438 0.861 8.014 5.259 8.035 5.531 C 7.86 5.082 3.61 1.186 3.522 1.59 C 2.973 1.027 0.916 4.611 1.17 4.873 C 0.728 4.914 5.088 7.961 5.61 7.995 C 5.225 7.532 0.622 12.315 0.826 12.559 Z'/%3e%3c/svg%3e")
		}

		.PopUp_blocks {
			width: 100%;
			height: 50%;
			display: flex;
			justify-content: space-evenly;
			align-items: center;
			flex-wrap: wrap;
			justify-content: center;
		}

		.PopUp_blocks:last-child {
			margin-top: 25px;
		}

		.PopUp_buttons {
			display: flex;
			margin: 7px 10px;
			flex-direction: column;
		}

		.PopUp_button {
			background-color: #52A81C;
			border-radius: 5px;
			box-shadow: inset 0px -4px 10px, inset 0px 3px 2px #99fe20, 0px 0px 4px, 0px -3px 1px #d7b275, 0px 0px 0px 3px #ce9767;
			cursor: pointer;
			padding: 4px 12px 6px;
		}

		.PopUp_input {
			text-align: center;
			font-size: 16px;
			height: 27px;
			border: 1px solid #cf9250;
			border-radius: 9px 9px 0px 0px;
			background: transparent;
			color: #fce1ac;
			padding: 1px 10px;
			box-sizing: border-box;
			box-shadow: 0px 0px 4px, 0px 0px 0px 3px #ce9767;
		}

		.PopUp_checkboxes {
			display: flex;
			flex-direction: column;
			margin: 15px 15px -5px 15px;
			align-items: flex-start;
		}

		.PopUp_ContCheckbox {
			margin: 2px 0px;
		}

		.PopUp_checkbox {
			position: absolute;
			z-index: -1;
			opacity: 0;
		}
		.PopUp_checkbox+label {
			display: inline-flex;
			align-items: center;
			user-select: none;

			font-size: 15px;
			font-family: sans-serif;
			font-weight: 600;
			font-stretch: condensed;
			letter-spacing: 1px;
			color: #fce1ac;
			text-shadow: 0px 0px 1px;
		}
		.PopUp_checkbox+label::before {
			content: '';
			display: inline-block;
			width: 20px;
			height: 20px;
			border: 1px solid #cf9250;
			border-radius: 7px;
			margin-right: 7px;
		}
		.PopUp_checkbox:checked+label::before {
			background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3e%3cpath fill='%2388cb13' d='M6.564.75l-3.59 3.612-1.538-1.55L0 4.26 2.974 7.25 8 2.193z'/%3e%3c/svg%3e");
		}

		.PopUp_input::placeholder {
			color: #fce1ac75;
		}

		.PopUp_input:focus {
			outline: 0;
		}

		.PopUp_input + .PopUp_button {
			border-radius: 0px 0px 5px 5px;
			padding: 2px 18px 5px;
		}

		.PopUp_button:hover {
			filter: brightness(1.2);
		}

		.PopUp_button:active {
			box-shadow: inset 0px 5px 10px, inset 0px 1px 2px #99fe20, 0px 0px 4px, 0px -3px 1px #d7b275, 0px 0px 0px 3px #ce9767;
		}

		.PopUp_text {
			font-size: 22px;
			font-family: sans-serif;
			font-weight: 600;
			font-stretch: condensed;
			letter-spacing: 1px;
			text-align: center;
		}

		.PopUp_buttonText {
			color: #E4FF4C;
			text-shadow: 0px 1px 2px black;
		}

		.PopUp_msgText {
			color: #FDE5B6;
			text-shadow: 0px 0px 2px;
		}

		.PopUp_hideBlock {
			display: none;
		}

		.PopUp_Container {
			max-height: 80vh;
			overflow-y: auto;
			overflow-x: hidden;
			scrollbar-width: thin;
			scrollbar-color: #774d10 #05040300;
			padding: 0 1rem;
		}
		`;
			document.head.appendChild(style);
		}

		const addBlocks = () => {
			this.back = document.createElement('div');
			this.back.classList.add('PopUp_back');
			this.back.classList.add('PopUp_hideBlock');
			document.body.append(this.back);

			this.popUp = document.createElement('div');
			this.popUp.classList.add('PopUp_');
			this.back.append(this.popUp);

			let upper = document.createElement('div')
			upper.classList.add('PopUp_blocks');
			this.popUp.append(upper);

			this.middle = document.createElement('div')
			this.middle.classList.add('PopUp_blocks');
			this.middle.classList.add('PopUp_checkboxes');
			this.popUp.append(this.middle);

			this.custom = document.createElement('div');
			this.custom.classList.add('PopUp_Container');
			this.popUp.append(this.custom);

			this.downer = document.createElement('div')
			this.downer.classList.add('PopUp_blocks');
			this.popUp.append(this.downer);

			this.msgText = document.createElement('div');
			this.msgText.classList.add('PopUp_text', 'PopUp_msgText');
			upper.append(this.msgText);
		}

		this.showBack = function () {
			this.back.classList.remove('PopUp_hideBlock');
		}

		this.hideBack = function () {
			this.back.classList.add('PopUp_hideBlock');
		}

		this.show = function () {
			if (this.checkboxes.length) {
				this.middle.classList.remove('PopUp_hideBlock');
			}
			this.showBack();
			this.popUp.classList.remove('PopUp_hideBlock');
		}

		this.hide = function () {
			this.hideBack();
			this.popUp.classList.add('PopUp_hideBlock');
		}

		this.addAnyButton = (option) => {
			const contButton = document.createElement('div');
			contButton.classList.add('PopUp_buttons');
			this.downer.append(contButton);

			let inputField = {
				value: option.result || option.default
			}
			if (option.isInput) {
				inputField = document.createElement('input');
				inputField.type = 'text';
				if (option.placeholder) {
					inputField.placeholder = option.placeholder;
				}
				if (option.default) {
					inputField.value = option.default;
				}
				inputField.classList.add('PopUp_input');
				contButton.append(inputField);
			}

			const button = document.createElement('div');
			button.classList.add('PopUp_button');
			button.title = option.title || '';
			contButton.append(button);

			const buttonText = document.createElement('div');
			buttonText.classList.add('PopUp_text', 'PopUp_buttonText');
			buttonText.innerHTML = option.msg;
			button.append(buttonText);

			return { button, contButton, inputField };
		}

		this.addCloseButton = () => {
			let button = document.createElement('div')
			button.classList.add('PopUp_close');
			this.popUp.append(button);

			let crossClose = document.createElement('div')
			crossClose.classList.add('PopUp_crossClose');
			button.append(crossClose);

			return { button, contButton: button };
		}

		this.addButton = (option, buttonClick) => {

			const { button, contButton, inputField } = option.isClose ? this.addCloseButton() : this.addAnyButton(option);
			if (option.isClose) {
				this.dialogPromice = { func: buttonClick, result: option.result };
			}
			button.addEventListener('click', () => {
				let result = '';
				if (option.isInput) {
					result = inputField.value;
				}
				if (option.isClose || option.isCancel) {
					this.dialogPromice = null;
				}
				buttonClick(result);
			});

			this.buttons.push(contButton);
		}

		this.clearButtons = () => {
			while (this.buttons.length) {
				this.buttons.pop().remove();
			}
		}

		this.addCheckBox = (checkBox) => {
			const contCheckbox = document.createElement('div');
			contCheckbox.classList.add('PopUp_ContCheckbox');
			this.middle.append(contCheckbox);

			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.id = 'PopUpCheckbox' + this.checkboxes.length;
			checkbox.dataset.name = checkBox.name;
			checkbox.checked = checkBox.checked;
			checkbox.label = checkBox.label;
			checkbox.title = checkBox.title || '';
			checkbox.classList.add('PopUp_checkbox');
			contCheckbox.appendChild(checkbox)

			const checkboxLabel = document.createElement('label');
			checkboxLabel.innerText = checkBox.label;
			checkboxLabel.title = checkBox.title || '';
			checkboxLabel.setAttribute('for', checkbox.id);
			contCheckbox.appendChild(checkboxLabel);

			this.checkboxes.push(checkbox);
		}

		this.clearCheckBox = () => {
			this.middle.classList.add('PopUp_hideBlock');
			while (this.checkboxes.length) {
				this.checkboxes.pop().parentNode.remove();
			}
		}

		this.clearCustomBlock = () => {
			this.custom.innerHTML = '';
		};

		this.setMsgText = (text) => {
			this.msgText.innerHTML = text;
		}

		this.getCheckBoxes = () => {
			const checkBoxes = [];

			for (const checkBox of this.checkboxes) {
				checkBoxes.push({
					name: checkBox.dataset.name,
					label: checkBox.label,
					checked: checkBox.checked
				});
			}

			return checkBoxes;
		}

		this.confirm = async (msg, buttOpt, checkBoxes = []) => {
			if (!this.isInit) {
				this.init();
			}
			this.clearButtons();
			this.clearCheckBox();
			this.clearCustomBlock();
			return new Promise((complete, failed) => {
				this.setMsgText(msg);
				if (!buttOpt) {
					buttOpt = [{ msg: 'Ok', result: true, isInput: false }];
				}
				for (const checkBox of checkBoxes) {
					this.addCheckBox(checkBox);
				}
				for (let butt of buttOpt) {
					this.addButton(butt, (result) => {
						result = result || butt.result;
						complete(result);
						popup.hide();
					});
					if (butt.isCancel) {
						this.dialogPromice = { func: complete, result: butt.result };
					}
				}
				this.show();
			});
		}

		this.customPopup = async (customFunc) => {
			if (!this.isInit) {
				this.init();
			}
			this.clearButtons();
			this.clearCheckBox();
			this.clearCustomBlock();
			return new Promise((complete, failed) => {
				customFunc(complete);
			});
		};
	});

	this.HWHFuncs.popup = popup;

	/**
	 * Миксин EventEmitter
	 * @param {Class} BaseClass Базовый класс (по умолчанию Object)
	 * @returns {Class} Класс с методами EventEmitter
	 */
	const EventEmitterMixin = (BaseClass = Object) =>
		class EventEmitter extends BaseClass {
			constructor(...args) {
				super(...args);
				this._events = new Map();
			}

			/**
			 * Подписаться на событие
			 * @param {string} event Имя события
			 * @param {function} listener Функция-обработчик
			 * @returns {this} Возвращает экземпляр для чейнинга
			 */
			on(event, listener) {
				if (typeof listener !== 'function') {
					throw new TypeError('Listener must be a function');
				}

				if (!this._events.has(event)) {
					this._events.set(event, new Set());
				}
				this._events.get(event).add(listener);
				return this;
			}

			/**
			 * Отписаться от события
			 * @param {string} event Имя события
			 * @param {function} listener Функция-обработчик
			 * @returns {this} Возвращает экземпляр для чейнинга
			 */
			off(event, listener) {
				if (this._events.has(event)) {
					const listeners = this._events.get(event);
					listeners.delete(listener);
					if (listeners.size === 0) {
						this._events.delete(event);
					}
				}
				return this;
			}

			/**
			 * Вызвать событие
			 * @param {string} event Имя события
			 * @param {...any} args Аргументы для обработчиков
			 * @returns {boolean} Было ли событие обработано
			 */
			emit(event, ...args) {
				if (!this._events.has(event)) return false;
				const listeners = new Set(this._events.get(event));
				listeners.forEach((listener) => {
					try {
						listener.apply(this, args);
					} catch (e) {
						console.error(`Error in event handler for "${event}":`, e);
					}
				});

				return true;
			}

			/**
			 * Подписаться на событие один раз
			 * @param {string} event Имя события
			 * @param {function} listener Функция-обработчик
			 * @returns {this} Возвращает экземпляр для чейнинга
			 */
			once(event, listener) {
				const onceWrapper = (...args) => {
					this.off(event, onceWrapper);
					listener.apply(this, args);
				};
				return this.on(event, onceWrapper);
			}

			/**
			 * Удалить все обработчики для события
			 * @param {string} [event] Имя события (если не указано - очистить все)
			 * @returns {this} Возвращает экземпляр для чейнинга
			 */
			removeAllListeners(event) {
				if (event) {
					this._events.delete(event);
				} else {
					this._events.clear();
				}
				return this;
			}

			/**
			 * Получить количество обработчиков для события
			 * @param {string} event Имя события
			 * @returns {number} Количество обработчиков
			 */
			listenerCount(event) {
				return this._events.has(event) ? this._events.get(event).size : 0;
			}
		};

	this.HWHFuncs.EventEmitterMixin = EventEmitterMixin;

	/**
	 * Script control panel
	 *
	 * Панель управления скриптом
	 */
	class ScriptMenu extends EventEmitterMixin() {
		constructor() {
			if (ScriptMenu.instance) {
				return ScriptMenu.instance;
			}
			super();
			this.mainMenu = null;
			this.buttons = [];
			this.checkboxes = [];
			this.option = {
				showMenu: true,
				showDetails: {},
			};
			ScriptMenu.instance = this;
			return this;
		}

		static getInst() {
			if (!ScriptMenu.instance) {
				new ScriptMenu();
			}
			return ScriptMenu.instance;
		}

		init(option = {}) {
			this.emit('beforeInit', option);
			this.option = Object.assign(this.option, option);
			const saveOption = this.loadSaveOption();
			this.option = Object.assign(this.option, saveOption);
			this.addStyle();
			this.addBlocks();
			this.emit('afterInit', option);
		}

		addStyle() {
			const style = document.createElement('style');
			style.innerText = `
				.scriptMenu_status {
					position: absolute;
					z-index: 10001;
					top: -1px;
					left: 30%;
					cursor: pointer;
					border-radius: 0px 0px 10px 10px;
					background: #190e08e6;
					border: 1px #ce9767 solid;
					font-size: 18px;
					font-family: sans-serif;
					font-weight: 600;
					font-stretch: condensed;
					letter-spacing: 1px;
					color: #fce1ac;
					text-shadow: 0px 0px 1px;
					transition: 0.5s;
					padding: 2px 10px 3px;
				}
				.scriptMenu_statusHide {
					top: -35px;
					height: 30px;
					overflow: hidden;
				}
				.scriptMenu_label {
					position: absolute;
					top: 30%;
					left: -4px;
					z-index: 9999;
					cursor: pointer;
					width: 30px;
					height: 30px;
					background: radial-gradient(circle, #47a41b 0%, #1a2f04 100%);
					border: 1px solid #1a2f04;
					border-radius: 5px;
					box-shadow:
					inset 0px 2px 4px #83ce26,
					inset 0px -4px 6px #1a2f04,
					0px 0px 2px black,
					0px 0px 0px 2px	#ce9767;
				}
				.scriptMenu_label:hover {
					filter: brightness(1.2);
				}
				.scriptMenu_arrowLabel {
					width: 100%;
					height: 100%;
					background-size: 75%;
					background-position: center;
					background-repeat: no-repeat;
					background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='%2388cb13' d='M7.596 7.304a.802.802 0 0 1 0 1.392l-6.363 3.692C.713 12.69 0 12.345 0 11.692V4.308c0-.653.713-.998 1.233-.696l6.363 3.692Z'/%3e%3cpath fill='%2388cb13' d='M15.596 7.304a.802.802 0 0 1 0 1.392l-6.363 3.692C8.713 12.69 8 12.345 8 11.692V4.308c0-.653.713-.998 1.233-.696l6.363 3.692Z'/%3e%3c/svg%3e");
					box-shadow: 0px 1px 2px #000;
					border-radius: 5px;
					filter: drop-shadow(0px 1px 2px #000D);
				}
				.scriptMenu_main {
					position: absolute;
					max-width: 285px;
					z-index: 9999;
					top: 50%;
					transform: translateY(-40%);
					background: #190e08e6;
					border: 1px #ce9767 solid;
					border-radius: 0px 10px 10px 0px;
					border-left: none;
					box-sizing: border-box;
					font-size: 15px;
					font-family: sans-serif;
					font-weight: 600;
					font-stretch: condensed;
					letter-spacing: 1px;
					color: #fce1ac;
					text-shadow: 0px 0px 1px;
					transition: 1s;
				}
				.scriptMenu_conteiner {
					max-height: 80vh;
					overflow: scroll;
					scrollbar-width: none; /* Для Firefox */
					-ms-overflow-style: none; /* Для Internet Explorer и Edge */
					display: flex;
					flex-direction: column;
					flex-wrap: nowrap;
					padding: 5px 10px 5px 5px;
				}
				.scriptMenu_conteiner::-webkit-scrollbar {
					display: none; /* Для Chrome, Safari и Opera */
				}
				.scriptMenu_showMenu {
					display: none;
				}
				.scriptMenu_showMenu:checked~.scriptMenu_main {
					left: 0px;
				}
				.scriptMenu_showMenu:not(:checked)~.scriptMenu_main {
					left: -300px;
				}
				.scriptMenu_divInput {
					margin: 2px;
				}
				.scriptMenu_divInputText {
					margin: 2px;
					align-self: center;
					display: flex;
				}
				.scriptMenu_checkbox {
					position: absolute;
					z-index: -1;
					opacity: 0;
				}
				.scriptMenu_checkbox+label {
					display: inline-flex;
					align-items: center;
					user-select: none;
				}
				.scriptMenu_checkbox+label::before {
					content: '';
					display: inline-block;
					width: 20px;
					height: 20px;
					border: 1px solid #cf9250;
					border-radius: 7px;
					margin-right: 7px;
				}
				.scriptMenu_checkbox:checked+label::before {
					background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3e%3cpath fill='%2388cb13' d='M6.564.75l-3.59 3.612-1.538-1.55L0 4.26 2.974 7.25 8 2.193z'/%3e%3c/svg%3e");
				}
				.scriptMenu_close {
					width: 40px;
					height: 40px;
					position: absolute;
					right: -18px;
					top: -18px;
					border: 3px solid #c18550;
					border-radius: 20px;
					background: radial-gradient(circle, rgba(190,30,35,1) 0%, rgba(0,0,0,1) 100%);
					background-position-y: 3px;
					box-shadow: -1px 1px 3px black;
					cursor: pointer;
					box-sizing: border-box;
				}
				.scriptMenu_close:hover {
					filter: brightness(1.2);
				}
				.scriptMenu_crossClose {
					width: 100%;
					height: 100%;
					background-size: 65%;
					background-position: center;
					background-repeat: no-repeat;
					background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='%23f4cd73' d='M 0.826 12.559 C 0.431 12.963 3.346 15.374 3.74 14.97 C 4.215 15.173 8.167 10.457 7.804 10.302 C 7.893 10.376 11.454 14.64 11.525 14.372 C 12.134 15.042 15.118 12.086 14.638 11.689 C 14.416 11.21 10.263 7.477 10.402 7.832 C 10.358 7.815 11.731 7.101 14.872 3.114 C 14.698 2.145 13.024 1.074 12.093 1.019 C 11.438 0.861 8.014 5.259 8.035 5.531 C 7.86 5.082 3.61 1.186 3.522 1.59 C 2.973 1.027 0.916 4.611 1.17 4.873 C 0.728 4.914 5.088 7.961 5.61 7.995 C 5.225 7.532 0.622 12.315 0.826 12.559 Z'/%3e%3c/svg%3e")
				}
				.scriptMenu_button {
					user-select: none;
					cursor: pointer;
					padding: 5px 14px 8px;
				}
				.scriptMenu_button:hover {
					filter: brightness(1.2);
				}
				.scriptMenu_buttonText {
					color: #fce5b7;
					text-shadow: 0px 1px 2px black;
					text-align: center;
				}
				.scriptMenu_header {
					text-align: center;
					align-self: center;
					font-size: 15px;
					margin: 0px 15px;
				}
				.scriptMenu_header a {
					color: #fce5b7;
					text-decoration: none;
				}
				.scriptMenu_InputText {
					text-align: center;
					width: 130px;
					height: 24px;
					border: 1px solid #cf9250;
					border-radius: 9px;
					background: transparent;
					color: #fce1ac;
					padding: 0px 10px;
					box-sizing: border-box;
				}
				.scriptMenu_InputText:focus {
					filter: brightness(1.2);
					outline: 0;
				}
				.scriptMenu_InputText::placeholder {
					color: #fce1ac75;
				}
				.scriptMenu_Summary {
					cursor: pointer;
					margin-left: 7px;
				}
				.scriptMenu_Details {
					align-self: center;
				}
				.scriptMenu_buttonGroup {
					display: flex;
					justify-content: center;
					user-select: none;
					cursor: pointer;
					padding: 0;
					margin: 3px 0;
				}
				.scriptMenu_buttonGroup .scriptMenu_button {
					width: 100%;
					padding: 5px 8px 8px;
				}
				.scriptMenu_mainButton {
					border-radius: 5px;
					margin: 3px 0;
				}
				.scriptMenu_combineButtonLeft {
					border-top-left-radius: 5px;
					border-bottom-left-radius: 5px;
					margin-right: 2px;
				}
				.scriptMenu_combineButtonCenter {
					border-radius: 0px;
					margin-right: 2px;
				}
				.scriptMenu_combineButtonRight {
					border-top-right-radius: 5px;
					border-bottom-right-radius: 5px;
				}
				.scriptMenu_beigeButton {
					border: 1px solid #442901;
					background: radial-gradient(circle, rgba(165,120,56,1) 80%, rgba(0,0,0,1) 110%);
					box-shadow: inset 0px 2px 4px #e9b282, inset 0px -4px 6px #442901, inset 0px 1px 6px #442901, inset 0px 0px 6px, 0px 0px 2px black, 0px 0px 0px 1px #ce9767;
				}
				.scriptMenu_beigeButton:active {
					box-shadow: inset 0px 4px 6px #442901, inset 0px 4px 6px #442901, inset 0px 0px 6px, 0px 0px 4px, 0px 0px 0px 1px #ce9767;
				}
				.scriptMenu_greenButton {
					border: 1px solid #1a2f04;
					background: radial-gradient(circle, #47a41b 0%, #1a2f04 150%);
					box-shadow: inset 0px 2px 4px #83ce26, inset 0px -4px 6px #1a2f04, 0px 0px 2px black, 0px 0px 0px 1px #ce9767;
				}
				.scriptMenu_greenButton:active {
					box-shadow: inset 0px 4px 6px #1a2f04, inset 0px 4px 6px #1a2f04, inset 0px 0px 6px, 0px 0px 4px, 0px 0px 0px 1px #ce9767;
				}
				.scriptMenu_redButton {
					border: 1px solid #440101;
					background: radial-gradient(circle, rgb(198, 34, 34) 80%, rgb(0, 0, 0) 110%);
					box-shadow: inset 0px 2px 4px #e98282, inset 0px -4px 6px #440101, inset 0px 1px 6px #440101, inset 0px 0px 6px, 0px 0px 2px black, 0px 0px 0px 1px #ce9767;
				}
				.scriptMenu_redButton:active {
					box-shadow: inset 0px 4px 6px #440101, inset 0px 4px 6px #440101, inset 0px 0px 6px, 0px 0px 4px, 0px 0px 0px 1px #ce9767;
				}
				.scriptMenu_attention {
					position: relative;
				}
				.scriptMenu_attention .scriptMenu_dot {
					display: flex;
					justify-content: center;
					align-items: center;
				}
				.scriptMenu_dot {
					position: absolute;
					top: -7px;
					right: -7px;
					width: 20px;
					height: 20px;
					border-radius: 50%;
					border: 1px solid #c18550;
					background: radial-gradient(circle, #f000 25%, black 100%);
					box-shadow: 0px 0px 2px black;
					background-position: 0px -1px;
					font-size: 10px;
					text-align: center;
					color: white;
					text-shadow: 1px 1px 1px black;
					box-sizing: border-box;
					display: none;
				}
			`;
			document.head.appendChild(style);
		}

		addBlocks() {
			const main = document.createElement('div');
			document.body.appendChild(main);

			this.status = document.createElement('div');
			this.status.classList.add('scriptMenu_status');
			this.setStatus('');
			main.appendChild(this.status);

			const label = document.createElement('label');
			label.classList.add('scriptMenu_label');
			label.setAttribute('for', 'checkbox_showMenu');
			main.appendChild(label);

			const arrowLabel = document.createElement('div');
			arrowLabel.classList.add('scriptMenu_arrowLabel');
			label.appendChild(arrowLabel);

			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.id = 'checkbox_showMenu';
			checkbox.checked = this.option.showMenu;
			checkbox.classList.add('scriptMenu_showMenu');
			checkbox.addEventListener('change', () => {
				this.option.showMenu = checkbox.checked;
				this.saveSaveOption();
			});
			main.appendChild(checkbox);

			const mainMenu = document.createElement('div');
			mainMenu.classList.add('scriptMenu_main');
			main.appendChild(mainMenu);

			this.mainMenu = document.createElement('div');
			this.mainMenu.classList.add('scriptMenu_conteiner');
			mainMenu.appendChild(this.mainMenu);

			const closeButton = document.createElement('label');
			closeButton.classList.add('scriptMenu_close');
			closeButton.setAttribute('for', 'checkbox_showMenu');
			this.mainMenu.appendChild(closeButton);

			const crossClose = document.createElement('div');
			crossClose.classList.add('scriptMenu_crossClose');
			closeButton.appendChild(crossClose);
		}

		getButtonColor(color) {
			const buttonColors = {
				green: 'scriptMenu_greenButton',
				red: 'scriptMenu_redButton',
				beige: 'scriptMenu_beigeButton',
			};
			return buttonColors[color] || buttonColors['beige'];
		}

		setStatus(text, onclick) {
			if (this._currentStatusClickHandler) {
				this.status.removeEventListener('click', this._currentStatusClickHandler);
				this._currentStatusClickHandler = null;
			}

			if (!text) {
				this.status.classList.add('scriptMenu_statusHide');
				this.status.innerHTML = '';
			} else {
				this.status.classList.remove('scriptMenu_statusHide');
				this.status.innerHTML = text;
			}

			if (typeof onclick === 'function') {
				this.status.addEventListener('click', onclick, { once: true });
				this._currentStatusClickHandler = onclick;
			}
		}

		addStatus(text) {
			if (!this.status.innerHTML) {
				this.status.classList.remove('scriptMenu_statusHide');
			}
			this.status.innerHTML += text;
		}

		addHeader(text, onClick, main = this.mainMenu) {
			this.emit('beforeAddHeader', text, onClick, main);
			const header = document.createElement('div');
			header.classList.add('scriptMenu_header');
			header.innerHTML = text;
			if (typeof onClick === 'function') {
				header.addEventListener('click', onClick);
			}
			main.appendChild(header);
			this.emit('afterAddHeader', text, onClick, main);
			return header;
		}

		addButton(btn, main = this.mainMenu) {
			this.emit('beforeAddButton', btn, main);
			const { name, onClick, title, color, dot, classes = [], isCombine } = btn;
			const button = document.createElement('div');
			if (!isCombine) {
				classes.push('scriptMenu_mainButton');
			}
			button.classList.add('scriptMenu_button', this.getButtonColor(color), ...classes);
			button.title = title;
			button.addEventListener('click', onClick);
			main.appendChild(button);

			const buttonText = document.createElement('div');
			buttonText.classList.add('scriptMenu_buttonText');
			buttonText.innerText = name;
			button.appendChild(buttonText);

			if (dot) {
				const dotAtention = document.createElement('div');
				dotAtention.classList.add('scriptMenu_dot');
				dotAtention.title = dot;
				button.appendChild(dotAtention);
			}

			this.buttons.push(button);
			this.emit('afterAddButton', button, btn);
			return button;
		}

		addCombinedButton(buttonList, main = this.mainMenu) {
			this.emit('beforeAddCombinedButton', buttonList, main);
			const buttonGroup = document.createElement('div');
			buttonGroup.classList.add('scriptMenu_buttonGroup');
			let count = 0;

			for (const btn of buttonList) {
				btn.isCombine = true;
				btn.classes ??= [];
				if (count === 0) {
					btn.classes.push('scriptMenu_combineButtonLeft');
				} else if (count === buttonList.length - 1) {
					btn.classes.push('scriptMenu_combineButtonRight');
				} else {
					btn.classes.push('scriptMenu_combineButtonCenter');
				}
				this.addButton(btn, buttonGroup);
				count++;
			}

			const dotAtention = document.createElement('div');
			dotAtention.classList.add('scriptMenu_dot');
			buttonGroup.appendChild(dotAtention);

			main.appendChild(buttonGroup);
			this.emit('afterAddCombinedButton', buttonGroup, buttonList);
			return buttonGroup;
		}

		addCheckbox(label, title, main = this.mainMenu) {
			this.emit('beforeAddCheckbox', label, title, main);
			const divCheckbox = document.createElement('div');
			divCheckbox.classList.add('scriptMenu_divInput');
			divCheckbox.title = title;
			main.appendChild(divCheckbox);

			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.id = 'scriptMenuCheckbox' + this.checkboxes.length;
			checkbox.classList.add('scriptMenu_checkbox');
			divCheckbox.appendChild(checkbox);

			const checkboxLabel = document.createElement('label');
			checkboxLabel.innerText = label;
			checkboxLabel.setAttribute('for', checkbox.id);
			divCheckbox.appendChild(checkboxLabel);

			this.checkboxes.push(checkbox);
			this.emit('afterAddCheckbox', label, title, main);
			return checkbox;
		}

		addInputText(title, placeholder, main = this.mainMenu) {
			this.emit('beforeAddCheckbox', title, placeholder, main);
			const divInputText = document.createElement('div');
			divInputText.classList.add('scriptMenu_divInputText');
			divInputText.title = title;
			main.appendChild(divInputText);

			const newInputText = document.createElement('input');
			newInputText.type = 'text';
			if (placeholder) {
				newInputText.placeholder = placeholder;
			}
			newInputText.classList.add('scriptMenu_InputText');
			divInputText.appendChild(newInputText);
			this.emit('afterAddCheckbox', title, placeholder, main);
			return newInputText;
		}

		addDetails(summaryText, name = null) {
			this.emit('beforeAddDetails', summaryText, name);
			const details = document.createElement('details');
			details.classList.add('scriptMenu_Details');
			this.mainMenu.appendChild(details);

			const summary = document.createElement('summary');
			summary.classList.add('scriptMenu_Summary');
			summary.innerText = summaryText;
			if (name) {
				details.open = this.option.showDetails[name] ?? false;
				details.dataset.name = name;
				details.addEventListener('toggle', () => {
					this.option.showDetails[details.dataset.name] = details.open;
					this.saveSaveOption();
				});
			}

			details.appendChild(summary);
			this.emit('afterAddDetails', summaryText, name);
			return details;
		}

		saveSaveOption() {
			try {
				localStorage.setItem('scriptMenu_saveOption', JSON.stringify(this.option));
			} catch (e) {
				console.log('¯\\_(ツ)_/¯');
			}
		}

		loadSaveOption() {
			let saveOption = null;
			try {
				saveOption = localStorage.getItem('scriptMenu_saveOption');
			} catch (e) {
				console.log('¯\\_(ツ)_/¯');
			}

			if (!saveOption) {
				return {};
			}

			try {
				saveOption = JSON.parse(saveOption);
			} catch (e) {
				return {};
			}

			return saveOption;
		}
	}

	this.HWHClasses.ScriptMenu = ScriptMenu;

	//const scriptMenu = ScriptMenu.getInst();

	/**
	 * Пример использования
	const scriptMenu = ScriptMenu.getInst();
	scriptMenu.init();
	scriptMenu.addHeader('v1.508');
	scriptMenu.addCheckbox('testHack', 'Тестовый взлом игры!');
	scriptMenu.addButton({
		text: 'Запуск!',
		onClick: () => console.log('click'),
		title: 'подсказака',
	});
	scriptMenu.addInputText('input подсказака');
	scriptMenu.on('beforeInit', (option) => {
		console.log('beforeInit', option);
	})
	scriptMenu.on('beforeAddHeader', (text, onClick, main) => {
		console.log('beforeAddHeader', text, onClick, main);
	});
	scriptMenu.on('beforeAddButton', (btn, main) => {
		console.log('beforeAddButton', btn, main);
	});
	scriptMenu.on('beforeAddCombinedButton', (buttonList, main) => {
		console.log('beforeAddCombinedButton', buttonList, main);
	});
	scriptMenu.on('beforeAddCheckbox', (label, title, main) => {
		console.log('beforeAddCheckbox', label, title, main);
	});
	scriptMenu.on('beforeAddDetails', (summaryText, name) => {
		console.log('beforeAddDetails', summaryText, name);
	});
	 */

	/**
	 * Game Library
	 *
	 * Игровая библиотека
	 */
	class Library {
		defaultLibUrl = 'https://heroesru-a.akamaihd.net/vk/v1101/lib/lib.json';

		constructor() {
			if (!Library.instance) {
				Library.instance = this;
			}

			return Library.instance;
		}

		async load() {
			try {
				await this.getUrlLib();
				console.log(this.defaultLibUrl);
				this.data = await fetch(this.defaultLibUrl).then(e => e.json())
			} catch (error) {
				console.error('Не удалось загрузить библиотеку', error)
			}
		}

		async getUrlLib() {
			try {
				const db = new Database('hw_cache', 'cache');
				await db.open();
				const cacheLibFullUrl = await db.get('lib/lib.json.gz', false);
				this.defaultLibUrl = cacheLibFullUrl.fullUrl.split('.gz').shift();
			} catch(e) {}
		}

		getData(id) {
			return this.data[id];
		}

		setData(data) {
			this.data = data;
		}
	}

	this.lib = new Library();
	/**
	 * Database
	 *
	 * База данных
	 */
	class Database {
		constructor(dbName, storeName) {
			this.dbName = dbName;
			this.storeName = storeName;
			this.db = null;
		}

		async open() {
			return new Promise((resolve, reject) => {
				const request = indexedDB.open(this.dbName);

				request.onerror = () => {
					reject(new Error(`Failed to open database ${this.dbName}`));
				};

				request.onsuccess = () => {
					this.db = request.result;
					resolve();
				};

				request.onupgradeneeded = (event) => {
					const db = event.target.result;
					if (!db.objectStoreNames.contains(this.storeName)) {
						db.createObjectStore(this.storeName);
					}
				};
			});
		}

		async set(key, value) {
			return new Promise((resolve, reject) => {
				const transaction = this.db.transaction([this.storeName], 'readwrite');
				const store = transaction.objectStore(this.storeName);
				const request = store.put(value, key);

				request.onerror = () => {
					reject(new Error(`Failed to save value with key ${key}`));
				};

				request.onsuccess = () => {
					resolve();
				};
			});
		}

		async get(key, def) {
			return new Promise((resolve, reject) => {
				const transaction = this.db.transaction([this.storeName], 'readonly');
				const store = transaction.objectStore(this.storeName);
				const request = store.get(key);

				request.onerror = () => {
					resolve(def);
				};

				request.onsuccess = () => {
					resolve(request.result);
				};
			});
		}

		async delete(key) {
			return new Promise((resolve, reject) => {
				const transaction = this.db.transaction([this.storeName], 'readwrite');
				const store = transaction.objectStore(this.storeName);
				const request = store.delete(key);

				request.onerror = () => {
					reject(new Error(`Failed to delete value with key ${key}`));
				};

				request.onsuccess = () => {
					resolve();
				};
			});
		}
	}

	/**
	 * Returns the stored value
	 *
	 * Возвращает сохраненное значение
	 */
	function getSaveVal(saveName, def) {
		const result = storage.get(saveName, def);
		return result;
	}
	this.HWHFuncs.getSaveVal = getSaveVal;

	/**
	 * Stores value
	 *
	 * Сохраняет значение
	 */
	function setSaveVal(saveName, value) {
		storage.set(saveName, value);
	}
	this.HWHFuncs.setSaveVal = setSaveVal;

	/**
	 * Database initialization
	 *
	 * Инициализация базы данных
	 */
	const db = new Database(GM_info.script.name, 'settings');

	/**
	 * Data store
	 *
	 * Хранилище данных
	 */
	const storage = {
		userId: 0,
		/**
		 * Default values
		 *
		 * Значения по умолчанию
		 */
		values: {},
		name: GM_info.script.name,
		init: function () {
			const { checkboxes, inputs } = HWHData;
			this.values = [
				...Object.entries(checkboxes).map((e) => ({ [e[0]]: e[1].default })),
				...Object.entries(inputs).map((e) => ({ [e[0]]: e[1].default })),
			].reduce((acc, obj) => ({ ...acc, ...obj }), {});
		},
		get: function (key, def) {
			if (key in this.values) {
				return this.values[key];
			}
			return def;
		},
		set: function (key, value) {
			this.values[key] = value;
			db.set(this.userId, this.values).catch((e) => null);
			localStorage[this.name + ':' + key] = value;
		},
		delete: function (key) {
			delete this.values[key];
			db.set(this.userId, this.values);
			delete localStorage[this.name + ':' + key];
		},
	};

	/**
	 * Returns all keys from localStorage that start with prefix (for migration)
	 *
	 * Возвращает все ключи из localStorage которые начинаются с prefix (для миграции)
	 */
	function getAllValuesStartingWith(prefix) {
		const values = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key.startsWith(prefix)) {
				const val = localStorage.getItem(key);
				const keyValue = key.split(':')[1];
				values.push({ key: keyValue, val });
			}
		}
		return values;
	}

	/**
	 * Opens or migrates to a database
	 *
	 * Открывает или мигрирует в базу данных
	 */
	async function openOrMigrateDatabase(userId) {
		storage.init();
		storage.userId = userId;
		try {
			await db.open();
		} catch(e) {
			return;
		}
		let settings = await db.get(userId, false);

		if (settings) {
			storage.values = settings;
			return;
		}

		const values = getAllValuesStartingWith(GM_info.script.name);
		for (const value of values) {
			let val = null;
			try {
				val = JSON.parse(value.val);
			} catch {
				break;
			}
			storage.values[value.key] = val;
		}
		await db.set(userId, storage.values);
	}

	class ZingerYWebsiteAPI {
		/**
		 * Class for interaction with the API of the zingery.ru website
		 * Intended only for use with the HeroWarsHelper script:
		 * https://greasyfork.org/ru/scripts/450693-herowarshelper
		 * Copyright ZingerY
		 */
		url = 'https://zingery.ru/heroes/';
		// YWJzb2x1dGVseSB1c2VsZXNzIGxpbmU=
		constructor(urn, env, data = {}) {
			this.urn = urn;
			this.fd = {
				now: Date.now(),
				fp: this.constructor.toString().replaceAll(/\s/g, ''),
				env: env.callee.toString().replaceAll(/\s/g, ''),
				info: (({ name, version, author }) => [name, version, author])(GM_info.script),
				...data,
			};
		}

		sign() {
			return md5([...this.fd.info, ~(this.fd.now % 1e3), this.fd.fp].join('_'));
		}

		encode(data) {
			return btoa(encodeURIComponent(JSON.stringify(data)));
		}

		decode(data) {
			return JSON.parse(decodeURIComponent(atob(data)));
		}

		headers() {
			return {
				'X-Request-Signature': this.sign(),
				'X-Script-Name': GM_info.script.name,
				'X-Script-Version': GM_info.script.version,
				'X-Script-Author': GM_info.script.author,
				'X-Script-ZingerY': 42,
			};
		}

		async request() {
			try {
				const response = await fetch(this.url + this.urn, {
					method: 'POST',
					headers: this.headers(),
					body: this.encode(this.fd),
				});
				const text = await response.text();
				return this.decode(text);
			} catch (e) {
				console.error(e);
				return [];
			}
		}
		/**
		 * Класс для взаимодействия с API сайта zingery.ru
		 * Предназначен только для использования со скриптом HeroWarsHelper:
		 * https://greasyfork.org/ru/scripts/450693-herowarshelper
		 * Copyright ZingerY
		 */
	}

	/**
	 * Sending expeditions
	 *
	 * Отправка экспедиций
	 */
	function checkExpedition() {
		const { Expedition } = HWHClasses;
		return new Promise((resolve, reject) => {
			const expedition = new Expedition(resolve, reject);
			expedition.start();
		});
	}

	class Expedition {
		checkExpedInfo = {
			calls: [
				{
					name: 'expeditionGet',
					args: {},
					ident: 'expeditionGet',
				},
				{
					name: 'heroGetAll',
					args: {},
					ident: 'heroGetAll',
				},
			],
		};

		constructor(resolve, reject) {
			this.resolve = resolve;
			this.reject = reject;
		}

		async start() {
			const data = await Send(JSON.stringify(this.checkExpedInfo));

			const expedInfo = data.results[0].result.response;
			const dataHeroes = data.results[1].result.response;
			const dataExped = { useHeroes: [], exped: [] };
			const calls = [];

			/**
			 * Adding expeditions to collect
			 * Добавляем экспедиции для сбора
			 */
			let countGet = 0;
			for (var n in expedInfo) {
				const exped = expedInfo[n];
				const dateNow = Date.now() / 1000;
				if (exped.status == 2 && exped.endTime != 0 && dateNow > exped.endTime) {
					countGet++;
					calls.push({
						name: 'expeditionFarm',
						args: { expeditionId: exped.id },
						ident: 'expeditionFarm_' + exped.id,
					});
				} else {
					dataExped.useHeroes = dataExped.useHeroes.concat(exped.heroes);
				}
				if (exped.status == 1) {
					dataExped.exped.push({ id: exped.id, power: exped.power });
				}
			}
			dataExped.exped = dataExped.exped.sort((a, b) => b.power - a.power);

			/**
			 * Putting together a list of heroes
			 * Собираем список героев
			 */
			const heroesArr = [];
			for (let n in dataHeroes) {
				const hero = dataHeroes[n];
				if (hero.power > 0 && !dataExped.useHeroes.includes(hero.id)) {
					let heroPower = hero.power;
					// Лара Крофт * 3
					if (hero.id == 63 && hero.color >= 16) {
						heroPower *= 3;
					}
					heroesArr.push({ id: hero.id, power: heroPower });
				}
			}

			/**
			 * Adding expeditions to send
			 * Добавляем экспедиции для отправки
			 */
			let countSend = 0;
			heroesArr.sort((a, b) => a.power - b.power);
			for (const exped of dataExped.exped) {
				let heroesIds = this.selectionHeroes(heroesArr, exped.power);
				if (heroesIds && heroesIds.length > 4) {
					for (let q in heroesArr) {
						if (heroesIds.includes(heroesArr[q].id)) {
							delete heroesArr[q];
						}
					}
					countSend++;
					calls.push({
						name: 'expeditionSendHeroes',
						args: {
							expeditionId: exped.id,
							heroes: heroesIds,
						},
						ident: 'expeditionSendHeroes_' + exped.id,
					});
				}
			}

			if (calls.length) {
				await Send({ calls });
				this.end(I18N('EXPEDITIONS_SENT', {countGet, countSend}));
				return;
			}

			this.end(I18N('EXPEDITIONS_NOTHING'));
		}

		/**
		 * Selection of heroes for expeditions
		 *
		 * Подбор героев для экспедиций
		 */
		selectionHeroes(heroes, power) {
			const resultHeroers = [];
			const heroesIds = [];
			for (let q = 0; q < 5; q++) {
				for (let i in heroes) {
					let hero = heroes[i];
					if (heroesIds.includes(hero.id)) {
						continue;
					}

					const summ = resultHeroers.reduce((acc, hero) => acc + hero.power, 0);
					const need = Math.round((power - summ) / (5 - resultHeroers.length));
					if (hero.power > need) {
						resultHeroers.push(hero);
						heroesIds.push(hero.id);
						break;
					}
				}
			}

			const summ = resultHeroers.reduce((acc, hero) => acc + hero.power, 0);
			if (summ < power) {
				return false;
			}
			return heroesIds;
		}

		/**
		 * Ends expedition script
		 *
		 * Завершает скрипт экспедиции
		 */
		end(msg) {
			setProgress(msg, true);
			this.resolve();
		}
	}

	this.HWHClasses.Expedition = Expedition;

	/**
	 * Walkthrough of the dungeon
	 *
	 * Прохождение подземелья
	 */
	function testDungeon() {
		const { executeDungeon } = HWHClasses;
		return new Promise((resolve, reject) => {
			const dung = new executeDungeon(resolve, reject);
			const titanit = getInput('countTitanit');
			dung.start(titanit);
		});
	}

	/**
	 * Walkthrough of the dungeon
	 *
	 * Прохождение подземелья
	 */
	function executeDungeon(resolve, reject) {
		dungeonActivity = 0;
		let maxDungeonActivity = 150;

		titanGetAll = [];

		teams = {
			heroes: [],
			earth: [],
			fire: [],
			neutral: [],
			water: [],
		}

		titanStats = [];

		titansStates = {};

		let talentMsg = '';
		let talentMsgReward = '';

		callsExecuteDungeon = {
			calls: [{
				name: "dungeonGetInfo",
				args: {},
				ident: "dungeonGetInfo"
			}, {
				name: "teamGetAll",
				args: {},
				ident: "teamGetAll"
			}, {
				name: "teamGetFavor",
				args: {},
				ident: "teamGetFavor"
			}, {
				name: "clanGetInfo",
				args: {},
				ident: "clanGetInfo"
			}, {
				name: "titanGetAll",
				args: {},
				ident: "titanGetAll"
			}, {
				name: "inventoryGet",
				args: {},
				ident: "inventoryGet"
			}]
		}

		this.start = function(titanit) {
			maxDungeonActivity = titanit || getInput('countTitanit');
			send(JSON.stringify(callsExecuteDungeon), startDungeon);
		}

		/**
		 * Getting data on the dungeon
		 *
		 * Получаем данные по подземелью
		 */
		function startDungeon(e) {
			res = e.results;
			dungeonGetInfo = res[0].result.response;
			if (!dungeonGetInfo) {
				endDungeon('noDungeon', res);
				return;
			}
			teamGetAll = res[1].result.response;
			teamGetFavor = res[2].result.response;
			dungeonActivity = res[3].result.response.stat.todayDungeonActivity;
			titanGetAll = Object.values(res[4].result.response);
			HWHData.countPredictionCard = res[5].result.response.consumable[81];

			teams.hero = {
				favor: teamGetFavor.dungeon_hero,
				heroes: teamGetAll.dungeon_hero.filter(id => id < 6000),
				teamNum: 0,
			}
			heroPet = teamGetAll.dungeon_hero.filter(id => id >= 6000).pop();
			if (heroPet) {
				teams.hero.pet = heroPet;
			}

			teams.neutral = {
				favor: {},
				heroes: getTitanTeam(titanGetAll, 'neutral'),
				teamNum: 0,
			};
			teams.water = {
				favor: {},
				heroes: getTitanTeam(titanGetAll, 'water'),
				teamNum: 0,
			};
			teams.fire = {
				favor: {},
				heroes: getTitanTeam(titanGetAll, 'fire'),
				teamNum: 0,
			};
			teams.earth = {
				favor: {},
				heroes: getTitanTeam(titanGetAll, 'earth'),
				teamNum: 0,
			};


			checkFloor(dungeonGetInfo);
		}

		function getTitanTeam(titans, type) {
			switch (type) {
				case 'neutral':
					return titans.sort((a, b) => b.power - a.power).slice(0, 5).map(e => e.id);
				case 'water':
					return titans.filter(e => e.id.toString().slice(2, 3) == '0').map(e => e.id);
				case 'fire':
					return titans.filter(e => e.id.toString().slice(2, 3) == '1').map(e => e.id);
				case 'earth':
					return titans.filter(e => e.id.toString().slice(2, 3) == '2').map(e => e.id);
			}
		}

		function getNeutralTeam() {
			const titans = titanGetAll.filter(e => !titansStates[e.id]?.isDead)
			return titans.sort((a, b) => b.power - a.power).slice(0, 5).map(e => e.id);
		}

		function fixTitanTeam(titans) {
			titans.heroes = titans.heroes.filter(e => !titansStates[e]?.isDead);
			return titans;
		}

		/**
		 * Checking the floor
		 *
		 * Проверяем этаж
		 */
		async function checkFloor(dungeonInfo) {
			if (!('floor' in dungeonInfo) || dungeonInfo.floor?.state == 2) {
				saveProgress();
				return;
			}
			checkTalent(dungeonInfo);
			// console.log(dungeonInfo, dungeonActivity);
			maxDungeonActivity = +getInput('countTitanit');
			setProgress(`${I18N('DUNGEON')}: ${I18N('TITANIT')} ${dungeonActivity}/${maxDungeonActivity} ${talentMsg}`);
			if (dungeonActivity >= maxDungeonActivity) {
				endDungeon('endDungeon', 'maxActive ' + dungeonActivity + '/' + maxDungeonActivity);
				return;
			}
			titansStates = dungeonInfo.states.titans;
			titanStats = titanObjToArray(titansStates);
			const floorChoices = dungeonInfo.floor.userData;
			const floorType = dungeonInfo.floorType;
			//const primeElement = dungeonInfo.elements.prime;
			if (floorType == "battle") {
				const calls = [];
				for (let teamNum in floorChoices) {
					attackerType = floorChoices[teamNum].attackerType;
					const args = fixTitanTeam(teams[attackerType]);
					if (attackerType == 'neutral') {
						args.heroes = getNeutralTeam();
					}
					if (!args.heroes.length) {
						continue;
					}
					args.teamNum = teamNum;
					calls.push({
						name: "dungeonStartBattle",
						args,
						ident: "body_" + teamNum
					})
				}
				if (!calls.length) {
					endDungeon('endDungeon', 'All Dead');
					return;
				}
				const battleDatas = await Send(JSON.stringify({ calls }))
					.then(e => e.results.map(n => n.result.response))
				const battleResults = [];
				for (n in battleDatas) {
					battleData = battleDatas[n]
					battleData.progress = [{ attackers: { input: ["auto", 0, 0, "auto", 0, 0] } }];
					battleResults.push(await Calc(battleData).then(result => {
						result.teamNum = n;
						result.attackerType = floorChoices[n].attackerType;
						return result;
					}));
				}
				processingPromises(battleResults)
			}
		}

		async function checkTalent(dungeonInfo) {
			const talent = dungeonInfo.talent;
			if (!talent) {
				return;
			}
			const dungeonFloor = +dungeonInfo.floorNumber;
			const talentFloor = +talent.floorRandValue;
			let doorsAmount = 3 - talent.conditions.doorsAmount;

			if (dungeonFloor === talentFloor && (!doorsAmount || !talent.conditions?.farmedDoors[dungeonFloor])) {
				const reward = await Send({
					calls: [
						{ name: 'heroTalent_getReward', args: { talentType: 'tmntDungeonTalent', reroll: false }, ident: 'group_0_body' },
						{ name: 'heroTalent_farmReward', args: { talentType: 'tmntDungeonTalent' }, ident: 'group_1_body' },
					],
				}).then((e) => e.results[0].result.response);
				const type = Object.keys(reward).pop();
				const itemId = Object.keys(reward[type]).pop();
				const count = reward[type][itemId];
				const itemName = cheats.translate(`LIB_${type.toUpperCase()}_NAME_${itemId}`);
				talentMsgReward += `<br> ${count} ${itemName}`;
				doorsAmount++;
			}
			talentMsg = `<br>TMNT Talent: ${doorsAmount}/3 ${talentMsgReward}<br>`;
		}

		function processingPromises(results) {
			let selectBattle = results[0];
			if (results.length < 2) {
				// console.log(selectBattle);
				if (!selectBattle.result.win) {
					endDungeon('dungeonEndBattle\n', selectBattle);
					return;
				}
				endBattle(selectBattle);
				return;
			}

			selectBattle = false;
			let bestState = -1000;
			for (const result of results) {
				const recovery = getState(result);
				if (recovery > bestState) {
					bestState = recovery;
					selectBattle = result
				}
			}
			// console.log(selectBattle.teamNum, results);
			if (!selectBattle || bestState <= -1000) {
				endDungeon('dungeonEndBattle\n', results);
				return;
			}

			startBattle(selectBattle.teamNum, selectBattle.attackerType)
				.then(endBattle);
		}

		/**
		 * Let's start the fight
		 *
		 * Начинаем бой
		 */
		function startBattle(teamNum, attackerType) {
			return new Promise(function (resolve, reject) {
				args = fixTitanTeam(teams[attackerType]);
				args.teamNum = teamNum;
				if (attackerType == 'neutral') {
					const titans = titanGetAll.filter(e => !titansStates[e.id]?.isDead)
					args.heroes = titans.sort((a, b) => b.power - a.power).slice(0, 5).map(e => e.id);
				}
				startBattleCall = {
					calls: [{
						name: "dungeonStartBattle",
						args,
						ident: "body"
					}]
				}
				send(JSON.stringify(startBattleCall), resultBattle, {
					resolve,
					teamNum,
					attackerType
				});
			});
		}
		/**
		 * Returns the result of the battle in a promise
		 *
		 * Возращает резульат боя в промис
		 */
		function resultBattle(resultBattles, args) {
			battleData = resultBattles.results[0].result.response;
			battleType = "get_tower";
			if (battleData.type == "dungeon_titan") {
				battleType = "get_titan";
			}
			battleData.progress = [{ attackers: { input: ["auto", 0, 0, "auto", 0, 0] } }];
			BattleCalc(battleData, battleType, function (result) {
				result.teamNum = args.teamNum;
				result.attackerType = args.attackerType;
				args.resolve(result);
			});
		}
		/**
		 * Finishing the fight
		 *
		 * Заканчиваем бой
		 */
		async function endBattle(battleInfo) {
			if (battleInfo.result.win) {
				const args = {
					result: battleInfo.result,
					progress: battleInfo.progress,
				}
				if (HWHData.countPredictionCard > 0) {
					args.isRaid = true;
				} else {
					const timer = getTimer(battleInfo.battleTime);
					console.log(timer);
					await countdownTimer(timer, `${I18N('DUNGEON')}: ${I18N('TITANIT')} ${dungeonActivity}/${maxDungeonActivity} ${talentMsg}`);
				}
				const calls = [{
					name: "dungeonEndBattle",
					args,
					ident: "body"
				}];
				lastDungeonBattleData = null;
				send(JSON.stringify({ calls }), resultEndBattle);
			} else {
				endDungeon('dungeonEndBattle win: false\n', battleInfo);
			}
		}

		/**
		 * Getting and processing battle results
		 *
		 * Получаем и обрабатываем результаты боя
		 */
		function resultEndBattle(e) {
			if ('error' in e) {
				popup.confirm(I18N('ERROR_MSG', {
					name: e.error.name,
					description: e.error.description,
				}));
				endDungeon('errorRequest', e);
				return;
			}
			battleResult = e.results[0].result.response;
			if ('error' in battleResult) {
				endDungeon('errorBattleResult', battleResult);
				return;
			}
			dungeonGetInfo = battleResult.dungeon ?? battleResult;
			dungeonActivity += battleResult.reward.dungeonActivity ?? 0;
			checkFloor(dungeonGetInfo);
		}

		/**
		 * Returns the coefficient of condition of the
		 * difference in titanium before and after the battle
		 *
		 * Возвращает коэффициент состояния титанов после боя
		 */
		function getState(result) {
			if (!result.result.win) {
				return -1000;
			}

			let beforeSumFactor = 0;
			const beforeTitans = result.battleData.attackers;
			for (let titanId in beforeTitans) {
				const titan = beforeTitans[titanId];
				const state = titan.state;
				let factor = 1;
				if (state) {
					const hp = state.hp / titan.hp;
					const energy = state.energy / 1e3;
					factor = hp + energy / 20
				}
				beforeSumFactor += factor;
			}

			let afterSumFactor = 0;
			const afterTitans = result.progress[0].attackers.heroes;
			for (let titanId in afterTitans) {
				const titan = afterTitans[titanId];
				const hp = titan.hp / beforeTitans[titanId].hp;
				const energy = titan.energy / 1e3;
				const factor = hp + energy / 20;
				afterSumFactor += factor;
			}
			return afterSumFactor - beforeSumFactor;
		}

		/**
		 * Converts an object with IDs to an array with IDs
		 *
		 * Преобразует объект с идетификаторами в массив с идетификаторами
		 */
		function titanObjToArray(obj) {
			let titans = [];
			for (let id in obj) {
				obj[id].id = id;
				titans.push(obj[id]);
			}
			return titans;
		}

		function saveProgress() {
			let saveProgressCall = {
				calls: [{
					name: "dungeonSaveProgress",
					args: {},
					ident: "body"
				}]
			}
			send(JSON.stringify(saveProgressCall), resultEndBattle);
		}

		function endDungeon(reason, info) {
			console.warn(reason, info);
			setProgress(`${I18N('DUNGEON')} ${I18N('COMPLETED')}`, true);
			resolve();
		}
	}

	this.HWHClasses.executeDungeon = executeDungeon;

	/**
	 * Passing the tower
	 *
	 * Прохождение башни
	 */
	function testTower() {
		const { executeTower } = HWHClasses;
		return new Promise((resolve, reject) => {
			tower = new executeTower(resolve, reject);
			tower.start();
		});
	}

	/**
	 * Passing the tower
	 *
	 * Прохождение башни
	 */
	function executeTower(resolve, reject) {
		lastTowerInfo = {};

		scullCoin = 0;

		heroGetAll = [];

		heroesStates = {};

		argsBattle = {
			heroes: [],
			favor: {},
		};

		callsExecuteTower = {
			calls: [{
				name: "towerGetInfo",
				args: {},
				ident: "towerGetInfo"
			}, {
				name: "teamGetAll",
				args: {},
				ident: "teamGetAll"
			}, {
				name: "teamGetFavor",
				args: {},
				ident: "teamGetFavor"
			}, {
				name: "inventoryGet",
				args: {},
				ident: "inventoryGet"
			}, {
				name: "heroGetAll",
				args: {},
				ident: "heroGetAll"
			}]
		}

		buffIds = [
			{id: 0, cost: 0, isBuy: false},   // plug // заглушка
			{id: 1, cost: 1, isBuy: true},    // 3% attack // 3% атака
			{id: 2, cost: 6, isBuy: true},    // 2% attack // 2% атака
			{id: 3, cost: 16, isBuy: true},   // 4% attack // 4% атака
			{id: 4, cost: 40, isBuy: true},   // 8% attack // 8% атака
			{id: 5, cost: 1, isBuy: true},    // 10% armor // 10% броня
			{id: 6, cost: 6, isBuy: true},    // 5% armor // 5% броня
			{id: 7, cost: 16, isBuy: true},   // 10% armor // 10% броня
			{id: 8, cost: 40, isBuy: true},   // 20% armor // 20% броня
			{ id: 9, cost: 1, isBuy: true },    // 10% protection from magic // 10% защита от магии
			{ id: 10, cost: 6, isBuy: true },   // 5% protection from magic // 5% защита от магии
			{ id: 11, cost: 16, isBuy: true },  // 10% protection from magic // 10% защита от магии
			{ id: 12, cost: 40, isBuy: true },  // 20% protection from magic // 20% защита от магии
			{ id: 13, cost: 1, isBuy: false },  // 40% health hero // 40% здоровья герою
			{ id: 14, cost: 6, isBuy: false },  // 40% health hero // 40% здоровья герою
			{ id: 15, cost: 16, isBuy: false }, // 80% health hero // 80% здоровья герою
			{ id: 16, cost: 40, isBuy: false }, // 40% health to all heroes // 40% здоровья всем героям
			{ id: 17, cost: 1, isBuy: false },  // 40% energy to the hero // 40% энергии герою
			{ id: 18, cost: 3, isBuy: false },  // 40% energy to the hero // 40% энергии герою
			{ id: 19, cost: 8, isBuy: false },  // 80% energy to the hero // 80% энергии герою
			{ id: 20, cost: 20, isBuy: false }, // 40% energy to all heroes // 40% энергии всем героям
			{ id: 21, cost: 40, isBuy: false }, // Hero Resurrection // Воскрешение героя
		]

		this.start = function () {
			send(JSON.stringify(callsExecuteTower), startTower);
		}

		/**
		 * Getting data on the Tower
		 *
		 * Получаем данные по башне
		 */
		function startTower(e) {
			res = e.results;
			towerGetInfo = res[0].result.response;
			if (!towerGetInfo) {
				endTower('noTower', res);
				return;
			}
			teamGetAll = res[1].result.response;
			teamGetFavor = res[2].result.response;
			inventoryGet = res[3].result.response;
			heroGetAll = Object.values(res[4].result.response);

			scullCoin = inventoryGet.coin[7] ?? 0;

			argsBattle.favor = teamGetFavor.tower;
			argsBattle.heroes = heroGetAll.sort((a, b) => b.power - a.power).slice(0, 5).map(e => e.id);
			pet = teamGetAll.tower.filter(id => id >= 6000).pop();
			if (pet) {
				argsBattle.pet = pet;
			}

			checkFloor(towerGetInfo);
		}

		function fixHeroesTeam(argsBattle) {
			let fixHeroes = argsBattle.heroes.filter(e => !heroesStates[e]?.isDead);
			if (fixHeroes.length < 5) {
				heroGetAll = heroGetAll.filter(e => !heroesStates[e.id]?.isDead);
				fixHeroes = heroGetAll.sort((a, b) => b.power - a.power).slice(0, 5).map(e => e.id);
				Object.keys(argsBattle.favor).forEach(e => {
					if (!fixHeroes.includes(+e)) {
						delete argsBattle.favor[e];
					}
				})
			}
			argsBattle.heroes = fixHeroes;
			return argsBattle;
		}

		/**
		 * Check the floor
		 *
		 * Проверяем этаж
		 */
		function checkFloor(towerInfo) {
			lastTowerInfo = towerInfo;
			maySkipFloor = +towerInfo.maySkipFloor;
			floorNumber = +towerInfo.floorNumber;
			heroesStates = towerInfo.states.heroes;
			floorInfo = towerInfo.floor;

			/**
			 * Is there at least one chest open on the floor
			 * Открыт ли на этаже хоть один сундук
			 */
			isOpenChest = false;
			if (towerInfo.floorType == "chest") {
				isOpenChest = towerInfo.floor.chests.reduce((n, e) => n + e.opened, 0);
			}

			setProgress(`${I18N('TOWER')}: ${I18N('FLOOR')} ${floorNumber}`);
			if (floorNumber > 49) {
				if (isOpenChest) {
					endTower('alreadyOpenChest 50 floor', floorNumber);
					return;
				}
			}
			/**
			 * If the chest is open and you can skip floors, then move on
			 * Если сундук открыт и можно скипать этажи, то переходим дальше
			 */
			if (towerInfo.mayFullSkip && +towerInfo.teamLevel == 130) {
				if (floorNumber == 1) {
					fullSkipTower();
					return;
				}
				if (isOpenChest) {
					nextOpenChest(floorNumber);
				} else {
					nextChestOpen(floorNumber);
				}
				return;
			}

			// console.log(towerInfo, scullCoin);
			switch (towerInfo.floorType) {
				case "battle":
					if (floorNumber <= maySkipFloor) {
						skipFloor();
						return;
					}
					if (floorInfo.state == 2) {
						nextFloor();
						return;
					}
					startBattle().then(endBattle);
					return;
				case "buff":
					checkBuff(towerInfo);
					return;
				case "chest":
					openChest(floorNumber);
					return;
				default:
					console.log('!', towerInfo.floorType, towerInfo);
					break;
			}
		}

		/**
		 * Let's start the fight
		 *
		 * Начинаем бой
		 */
		function startBattle() {
			return new Promise(function (resolve, reject) {
				towerStartBattle = {
					calls: [{
						name: "towerStartBattle",
						args: fixHeroesTeam(argsBattle),
						ident: "body"
					}]
				}
				send(JSON.stringify(towerStartBattle), resultBattle, resolve);
			});
		}
		/**
		 * Returns the result of the battle in a promise
		 *
		 * Возращает резульат боя в промис
		 */
		function resultBattle(resultBattles, resolve) {
			battleData = resultBattles.results[0].result.response;
			battleType = "get_tower";
			BattleCalc(battleData, battleType, function (result) {
				resolve(result);
			});
		}
		/**
		 * Finishing the fight
		 *
		 * Заканчиваем бой
		 */
		function endBattle(battleInfo) {
			if (battleInfo.result.stars >= 3) {
				endBattleCall = {
					calls: [{
						name: "towerEndBattle",
						args: {
							result: battleInfo.result,
							progress: battleInfo.progress,
						},
						ident: "body"
					}]
				}
				send(JSON.stringify(endBattleCall), resultEndBattle);
			} else {
				endTower('towerEndBattle win: false\n', battleInfo);
			}
		}

		/**
		 * Getting and processing battle results
		 *
		 * Получаем и обрабатываем результаты боя
		 */
		function resultEndBattle(e) {
			battleResult = e.results[0].result.response;
			if ('error' in battleResult) {
				endTower('errorBattleResult', battleResult);
				return;
			}
			if ('reward' in battleResult) {
				scullCoin += battleResult.reward?.coin[7] ?? 0;
			}
			nextFloor();
		}

		function nextFloor() {
			nextFloorCall = {
				calls: [{
					name: "towerNextFloor",
					args: {},
					ident: "body"
				}]
			}
			send(JSON.stringify(nextFloorCall), checkDataFloor);
		}

		function openChest(floorNumber) {
			floorNumber = floorNumber || 0;
			openChestCall = {
				calls: [{
					name: "towerOpenChest",
					args: {
						num: 2
					},
					ident: "body"
				}]
			}
			send(JSON.stringify(openChestCall), floorNumber < 50 ? nextFloor : lastChest);
		}

		function lastChest() {
			endTower('openChest 50 floor', floorNumber);
		}

		function skipFloor() {
			skipFloorCall = {
				calls: [{
					name: "towerSkipFloor",
					args: {},
					ident: "body"
				}]
			}
			send(JSON.stringify(skipFloorCall), checkDataFloor);
		}

		function checkBuff(towerInfo) {
			buffArr = towerInfo.floor;
			promises = [];
			for (let buff of buffArr) {
				buffInfo = buffIds[buff.id];
				if (buffInfo.isBuy && buffInfo.cost <= scullCoin) {
					scullCoin -= buffInfo.cost;
					promises.push(buyBuff(buff.id));
				}
			}
			Promise.all(promises).then(nextFloor);
		}

		function buyBuff(buffId) {
			return new Promise(function (resolve, reject) {
				buyBuffCall = {
					calls: [{
						name: "towerBuyBuff",
						args: {
							buffId
						},
						ident: "body"
					}]
				}
				send(JSON.stringify(buyBuffCall), resolve);
			});
		}

		function checkDataFloor(result) {
			towerInfo = result.results[0].result.response;
			if ('reward' in towerInfo && towerInfo.reward?.coin) {
				scullCoin += towerInfo.reward?.coin[7] ?? 0;
			}
			if ('tower' in towerInfo) {
				towerInfo = towerInfo.tower;
			}
			if ('skullReward' in towerInfo) {
				scullCoin += towerInfo.skullReward?.coin[7] ?? 0;
			}
			checkFloor(towerInfo);
		}
		/**
		 * Getting tower rewards
		 *
		 * Получаем награды башни
		 */
		function farmTowerRewards(reason) {
			let { pointRewards, points } = lastTowerInfo;
			let pointsAll = Object.getOwnPropertyNames(pointRewards);
			let farmPoints = pointsAll.filter(e => +e <= +points && !pointRewards[e]);
			if (!farmPoints.length) {
				return;
			}
			let farmTowerRewardsCall = {
				calls: [{
					name: "tower_farmPointRewards",
					args: {
						points: farmPoints
					},
					ident: "tower_farmPointRewards"
				}]
			}

			if (scullCoin > 0) {
				farmTowerRewardsCall.calls.push({
					name: "tower_farmSkullReward",
					args: {},
					ident: "tower_farmSkullReward"
				});
			}

			send(JSON.stringify(farmTowerRewardsCall), () => { });
		}

		function fullSkipTower() {
			/**
			 * Next chest
			 *
			 * Следующий сундук
			 */
			function nextChest(n) {
				return {
					name: "towerNextChest",
					args: {},
					ident: "group_" + n + "_body"
				}
			}
			/**
			 * Open chest
			 *
			 * Открыть сундук
			 */
			function openChest(n) {
				return {
					name: "towerOpenChest",
					args: {
						"num": 2
					},
					ident: "group_" + n + "_body"
				}
			}

			const fullSkipTowerCall = {
				calls: []
			}

			let n = 0;
			for (let i = 0; i < 15; i++) {
				// 15 сундуков
				fullSkipTowerCall.calls.push(nextChest(++n));
				fullSkipTowerCall.calls.push(openChest(++n));
				// +5 сундуков, 250 изюма // towerOpenChest
				// if (i < 5) {
				// 	fullSkipTowerCall.calls.push(openChest(++n, 2));
				// }
			}

			fullSkipTowerCall.calls.push({
				name: 'towerGetInfo',
				args: {},
				ident: 'group_' + ++n + '_body',
			});

			send(JSON.stringify(fullSkipTowerCall), data => {
				for (const r of data.results) {
					const towerInfo = r?.result?.response;
					if (towerInfo && 'skullReward' in towerInfo) {
						scullCoin += towerInfo.skullReward?.coin[7] ?? 0;
					}
				}
				data.results[0] = data.results[data.results.length - 1];
				checkDataFloor(data);
			});
		}

		function nextChestOpen(floorNumber) {
			const calls = [{
				name: "towerOpenChest",
				args: {
					num: 2
				},
				ident: "towerOpenChest"
			}];

			Send(JSON.stringify({ calls })).then(e => {
				nextOpenChest(floorNumber);
			});
		}

		function nextOpenChest(floorNumber) {
			if (floorNumber > 49) {
				endTower('openChest 50 floor', floorNumber);
				return;
			}

			let nextOpenChestCall = {
				calls: [{
					name: "towerNextChest",
					args: {},
					ident: "towerNextChest"
				}, {
					name: "towerOpenChest",
					args: {
						num: 2
					},
					ident: "towerOpenChest"
				}]
			}
			send(JSON.stringify(nextOpenChestCall), checkDataFloor);
		}

		function endTower(reason, info) {
			console.log(reason, info);
			if (reason != 'noTower') {
				farmTowerRewards(reason);
			}
			setProgress(`${I18N('TOWER')} ${I18N('COMPLETED')}!`, true);
			resolve();
		}
	}

	this.HWHClasses.executeTower = executeTower;

	/**
	 * Passage of the arena of the titans
	 *
	 * Прохождение арены титанов
	 */
	function testTitanArena() {
		const { executeTitanArena } = HWHClasses;
		return new Promise((resolve, reject) => {
			titAren = new executeTitanArena(resolve, reject);
			titAren.start();
		});
	}

	/**
	 * Passage of the arena of the titans
	 *
	 * Прохождение арены титанов
	 */
	function executeTitanArena(resolve, reject) {
		let titan_arena = [];
		let finishListBattle = [];
		/**
		 * ID of the current batch
		 *
		 * Идетификатор текущей пачки
		 */
		let currentRival = 0;
		/**
		 * Number of attempts to finish off the pack
		 *
		 * Количество попыток добития пачки
		 */
		let attempts = 0;
		/**
		 * Was there an attempt to finish off the current shooting range
		 *
		 * Была ли попытка добития текущего тира
		 */
		let isCheckCurrentTier = false;
		/**
		 * Current shooting range
		 *
		 * Текущий тир
		 */
		let currTier = 0;
		/**
		 * Number of battles on the current dash
		 *
		 * Количество битв на текущем тире
		 */
		let countRivalsTier = 0;

		let callsStart = {
			calls: [{
				name: "titanArenaGetStatus",
				args: {},
				ident: "titanArenaGetStatus"
			}, {
				name: "teamGetAll",
				args: {},
				ident: "teamGetAll"
			}]
		}

		this.start = function () {
			send(JSON.stringify(callsStart), startTitanArena);
		}

		function startTitanArena(data) {
			let titanArena = data.results[0].result.response;
			if (titanArena.status == 'disabled') {
				endTitanArena('disabled', titanArena);
				return;
			}

			let teamGetAll = data.results[1].result.response;
			titan_arena = teamGetAll.titan_arena;

			checkTier(titanArena)
		}

		function checkTier(titanArena) {
			if (titanArena.status == "peace_time") {
				endTitanArena('Peace_time', titanArena);
				return;
			}
			currTier = titanArena.tier;
			if (currTier) {
				setProgress(`${I18N('TITAN_ARENA')}: ${I18N('LEVEL')} ${currTier}`);
			}

			if (titanArena.status == "completed_tier") {
				titanArenaCompleteTier();
				return;
			}
			/**
			 * Checking for the possibility of a raid
			 * Проверка на возможность рейда
			 */
			if (titanArena.canRaid) {
				titanArenaStartRaid();
				return;
			}
			/**
			 * Check was an attempt to achieve the current shooting range
			 * Проверка была ли попытка добития текущего тира
			 */
			if (!isCheckCurrentTier) {
				checkRivals(titanArena.rivals);
				return;
			}

			endTitanArena('Done or not canRaid', titanArena);
		}
		/**
		 * Submit dash information for verification
		 *
		 * Отправка информации о тире на проверку
		 */
		function checkResultInfo(data) {
			let titanArena = data.results[0].result.response;
			checkTier(titanArena);
		}
		/**
		 * Finish the current tier
		 *
		 * Завершить текущий тир
		 */
		function titanArenaCompleteTier() {
			isCheckCurrentTier = false;
			let calls = [{
				name: "titanArenaCompleteTier",
				args: {},
				ident: "body"
			}];
			send(JSON.stringify({calls}), checkResultInfo);
		}
		/**
		 * Gathering points to be completed
		 *
		 * Собираем точки которые нужно добить
		 */
		function checkRivals(rivals) {
			finishListBattle = [];
			for (let n in rivals) {
				if (rivals[n].attackScore < 250) {
					finishListBattle.push(n);
				}
			}
			console.log('checkRivals', finishListBattle);
			countRivalsTier = finishListBattle.length;
			roundRivals();
		}
		/**
		 * Selecting the next point to finish off
		 *
		 * Выбор следующей точки для добития
		 */
		function roundRivals() {
			let countRivals = finishListBattle.length;
			if (!countRivals) {
				/**
				 * Whole range checked
				 *
				 * Весь тир проверен
				 */
				isCheckCurrentTier = true;
				titanArenaGetStatus();
				return;
			}
			// setProgress('TitanArena: Уровень ' + currTier + ' Бои: ' + (countRivalsTier - countRivals + 1) + '/' + countRivalsTier);
			currentRival = finishListBattle.pop();
			attempts = +currentRival;
			// console.log('roundRivals', currentRival);
			titanArenaStartBattle(currentRival);
		}
		/**
		 * The start of a solo battle
		 *
		 * Начало одиночной битвы
		 */
		function titanArenaStartBattle(rivalId) {
			let calls = [{
				name: "titanArenaStartBattle",
				args: {
					rivalId: rivalId,
					titans: titan_arena
				},
				ident: "body"
			}];
			send(JSON.stringify({calls}), calcResult);
		}
		/**
		 * Calculation of the results of the battle
		 *
		 * Расчет результатов боя
		 */
		function calcResult(data) {
			let battlesInfo = data.results[0].result.response.battle;
			/**
			 * If attempts are equal to the current battle number we make
			 * Если попытки равны номеру текущего боя делаем прерасчет
			 */
			if (attempts == currentRival) {
				preCalcBattle(battlesInfo);
				return;
			}
			/**
			 * If there are still attempts, we calculate a new battle
			 * Если попытки еще есть делаем расчет нового боя
			 */
			if (attempts > 0) {
				attempts--;
				calcBattleResult(battlesInfo)
					.then(resultCalcBattle);
				return;
			}
			/**
			 * Otherwise, go to the next opponent
			 * Иначе переходим к следующему сопернику
			 */
			roundRivals();
		}
		/**
		 * Processing the results of the battle calculation
		 *
		 * Обработка результатов расчета битвы
		 */
		async function resultCalcBattle(resultBattle) {
			// console.log('resultCalcBattle', currentRival, attempts, resultBattle.result.win);
			/**
			 * If the current calculation of victory is not a chance or the attempt ended with the finish the battle
			 * Если текущий расчет победа или шансов нет или попытки кончились завершаем бой
			 */
			if (resultBattle.result.win || !attempts) {
				let { progress, result } = resultBattle;
				/*
				if (!resultBattle.result.win && isChecked('tryFixIt_v2')) {
					const bFix = new BestOrWinFixBattle(resultBattle.battleData);
					bFix.isGetTimer = false;
					bFix.maxTimer = 100;
					const resultFix = await bFix.start(Date.now() + 6e4, 500);
					if (resultFix.value > 0) {
						progress = resultFix.progress;
						result = resultFix.result;
					}
				}
				*/
				titanArenaEndBattle({
					progress,
					result,
					rivalId: resultBattle.battleData.typeId,
				});
				return;
			}
			/**
			 * If not victory and there are attempts we start a new battle
			 * Если не победа и есть попытки начинаем новый бой
			 */
			titanArenaStartBattle(resultBattle.battleData.typeId);
		}
		/**
		 * Returns the promise of calculating the results of the battle
		 *
		 * Возращает промис расчета результатов битвы
		 */
		function getBattleInfo(battle, isRandSeed) {
			return new Promise(function (resolve) {
				battle = structuredClone(battle);
				if (isRandSeed) {
					battle.seed = Math.floor(Date.now() / 1000) + random(0, 1e3);
				}
				// console.log(battle.seed);
				BattleCalc(battle, "get_titanClanPvp", e => resolve(e));
			});
		}
		/**
		 * Recalculate battles
		 *
		 * Прерасчтет битвы
		 */
		function preCalcBattle(battle) {
			let actions = [getBattleInfo(battle, false)];
			const countTestBattle = getInput('countTestBattle');
			for (let i = 0; i < countTestBattle; i++) {
				actions.push(getBattleInfo(battle, true));
			}
			Promise.all(actions)
				.then(resultPreCalcBattle);
		}
		/**
		 * Processing the results of the battle recalculation
		 *
		 * Обработка результатов прерасчета битвы
		 */
		function resultPreCalcBattle(e) {
			let wins = e.map(n => n.result.win);
			let firstBattle = e.shift();
			let countWin = wins.reduce((w, s) => w + s);
			const countTestBattle = getInput('countTestBattle');
			console.log('resultPreCalcBattle', `${countWin}/${countTestBattle}`)
			if (countWin > 0) {
				attempts = getInput('countAutoBattle');
			} else {
				attempts = 0;
			}
			resultCalcBattle(firstBattle);
		}

		/**
		 * Complete an arena battle
		 *
		 * Завершить битву на арене
		 */
		function titanArenaEndBattle(args) {
			let calls = [{
				name: "titanArenaEndBattle",
				args,
				ident: "body"
			}];
			send(JSON.stringify({calls}), resultTitanArenaEndBattle);
		}

		function resultTitanArenaEndBattle(e) {
			let attackScore = e.results[0].result.response.attackScore;
			let numReval = countRivalsTier - finishListBattle.length;
			setProgress(`${I18N('TITAN_ARENA')}: ${I18N('LEVEL')} ${currTier} </br>${I18N('BATTLES')}: ${numReval}/${countRivalsTier} - ${attackScore}`);
			// console.log('resultTitanArenaEndBattle', e)
			console.log('resultTitanArenaEndBattle', numReval + '/' + countRivalsTier, attempts)
			roundRivals();
		}
		/**
		 * Arena State
		 *
		 * Состояние арены
		 */
		function titanArenaGetStatus() {
			let calls = [{
				name: "titanArenaGetStatus",
				args: {},
				ident: "body"
			}];
			send(JSON.stringify({calls}), checkResultInfo);
		}
		/**
		 * Arena Raid Request
		 *
		 * Запрос рейда арены
		 */
		function titanArenaStartRaid() {
			let calls = [{
				name: "titanArenaStartRaid",
				args: {
					titans: titan_arena
				},
				ident: "body"
			}];
			send(JSON.stringify({calls}), calcResults);
		}

		function calcResults(data) {
			let battlesInfo = data.results[0].result.response;
			let {attackers, rivals} = battlesInfo;

			let promises = [];
			for (let n in rivals) {
				rival = rivals[n];
				promises.push(calcBattleResult({
					attackers: attackers,
					defenders: [rival.team],
					seed: rival.seed,
					typeId: n,
				}));
			}

			Promise.all(promises)
				.then(results => {
					const endResults = {};
					for (let info of results) {
						let id = info.battleData.typeId;
						endResults[id] = {
							progress: info.progress,
							result: info.result,
						}
					}
					titanArenaEndRaid(endResults);
				});
		}

		function calcBattleResult(battleData) {
			return new Promise(function (resolve, reject) {
				BattleCalc(battleData, "get_titanClanPvp", resolve);
			});
		}

		/**
		 * Sending Raid Results
		 *
		 * Отправка результатов рейда
		 */
		function titanArenaEndRaid(results) {
			titanArenaEndRaidCall = {
				calls: [{
					name: "titanArenaEndRaid",
					args: {
						results
					},
					ident: "body"
				}]
			}
			send(JSON.stringify(titanArenaEndRaidCall), checkRaidResults);
		}

		function checkRaidResults(data) {
			results = data.results[0].result.response.results;
			isSucsesRaid = true;
			for (let i in results) {
				isSucsesRaid &&= (results[i].attackScore >= 250);
			}

			if (isSucsesRaid) {
				titanArenaCompleteTier();
			} else {
				titanArenaGetStatus();
			}
		}

		function titanArenaFarmDailyReward() {
			titanArenaFarmDailyRewardCall = {
				calls: [{
					name: "titanArenaFarmDailyReward",
					args: {},
					ident: "body"
				}]
			}
			send(JSON.stringify(titanArenaFarmDailyRewardCall), () => {console.log('Done farm daily reward')});
		}

		function endTitanArena(reason, info) {
			if (!['Peace_time', 'disabled'].includes(reason)) {
				titanArenaFarmDailyReward();
			}
			console.log(reason, info);
			setProgress(`${I18N('TITAN_ARENA')} ${I18N('COMPLETED')}!`, true);
			resolve();
		}
	}

	/**
	 * Arena battle calculator helper functions
	 *
	 * Вспомогательные функции для расчета битв арены
	 */

	/**
	 * Calculate win rate for arena battle
	 *
	 * Расчет вероятности победы в битве арены
	 */
	async function calcArenaBattleWinRate(attackers, defenders, battleType = 'arena') {
		return new Promise((resolve, reject) => {
			const battleData = {
				attackers: attackers,
				defenders: defenders,
				seed: Math.random(),
				typeId: battleType
			};

			BattleCalc(battleData, getBattleType(battleType), (result) => {
				if (result && result.result) {
					resolve(result.result.win ? 1 : 0);
				} else {
					resolve(0);
				}
			});
		});
	}

	/**
	 * Select best team for opponent
	 *
	 * Выбор лучшей команды против соперника
	 */
	async function selectBestTeamForOpponent(availableTeams, opponentTeam, battleType = 'arena') {
		// Follow adventure pattern: Use system's pre-configured team only
		// No dynamic team selection - use what the system provides
		if (availableTeams.current) {
			const winRate = await calcArenaBattleWinRate(availableTeams.current, opponentTeam, battleType);
			return { team: availableTeams.current, winRate: winRate };
		}

		// Fallback if no current team available
		console.warn('No current team available from system');
		return { team: null, winRate: 0 };
	}

	/**
	 * Evaluate opponent difficulty
	 *
	 * Оценка сложности соперника
	 */
	function evaluateOpponentDifficulty(opponent) {
		// Calculate power ratio (opponent power / your power)
		const powerRatio = opponent.power / (userInfo.power || 1);

		// Lower rank = easier opponent
		const rankDifficulty = opponent.rank || 999999;

		// Return difficulty score (lower = easier)
		return {
			opponent: opponent,
			difficulty: powerRatio + (rankDifficulty / 1000000),
			powerRatio: powerRatio,
			rank: rankDifficulty
		};
	}

	/**
	 * Arena auto-attack execution
	 *
	 * Автоматическое прохождение арены
	 */
	function executeArena(resolve, reject) {
		this.resolve = resolve;
		this.reject = reject;
		this.arenaType = 'arena';
		this.attemptsRemaining = 0;
		this.victories = 0;
		this.arenaInfo = null;
		this.teamInfo = null;
		this.opponents = [];

		this.start = async function(arenaType = 'arena') {
			this.arenaType = arenaType;
			setProgress(`${this.arenaType === 'grand' ? I18N('GRAND_ARENA') : I18N('ARENA')}: ${I18N('INITIALIZING')}...`);

			try {
				// Get arena status and team data
				await this.getArenaStatus();

				if (this.attemptsRemaining <= 0) {
					if (this.arenaInfo && this.arenaInfo.status === 'peace_time') {
						this.end('Arena is in peace time - no battles available');
					} else if (this.arenaInfo && this.arenaInfo.status === 'disabled') {
						this.end('Arena is disabled - no battles available');
					} else if (this.arenaInfo && this.arenaInfo.status === 'error') {
						// Try to get more specific error information
						const errorMsg = this.arenaInfo.errorMessage || 'Arena API error - no battles available';
						this.end(errorMsg);
					} else {
						this.end('No attempts remaining');
					}
					return;
				}

				await this.getAvailableTeams();

				// Get detailed opponent information
				const detailedOpponents = await this.getArenaOpponents();
				if (detailedOpponents && Object.keys(detailedOpponents).length > 0) {
					this.opponents = detailedOpponents;
				}

				// Find and sort opponents by difficulty
				this.findEasiestOpponents();

				// Execute battles
				await this.executeBattles();

			} catch (error) {
				console.error('Arena execution error:', error);
				this.end('Error: ' + error.message);
			}
		}

		this.getArenaStatus = async function() {
			// Try to get actual arena status using userGetInfo
			try {
				const calls = [{
					name: "userGetInfo",
					args: {},
					context: { actionTs: Date.now() },
					ident: "body"
				}];

				const response = await Send(JSON.stringify({calls}));
				console.log('User info response:', response);

				if (response && response.results && response.results[0] && response.results[0].result) {
					const userInfo = response.results[0].result.response;
					console.log('User info:', userInfo);

					// Extract arena information based on arena type
					if (this.arenaType === 'grand') {
						// Grand Arena specific checks
						this.arenaInfo = {
							attempts: userInfo.grandAttempts || 0,
							rank: userInfo.grandPlace || 1000,
							status: userInfo.grandAttempts > 0 ? 'active' : 'no_attempts',
							rivals: [],
							canUpdateDefenders: false,
							battleStartTs: 0
						};
						this.attemptsRemaining = 1; // Only do one battle per execution due to cooldown

						if (userInfo.grandAttempts <= 0) {
							setProgress(`${I18N('GRAND_ARENA')}: No attempts remaining (${userInfo.grandAttempts})`);
							return;
						}

						setProgress(`${I18N('GRAND_ARENA')}: ${userInfo.grandAttempts} attempts available - executing single battle`);
						return;
					} else {
						// Regular Arena checks
						this.arenaInfo = {
							attempts: userInfo.arenaAttempts || 0,
							rank: userInfo.arenaPlace || 1000,
							status: userInfo.arenaAttempts > 0 ? 'active' : 'no_attempts',
							rivals: [],
							canUpdateDefenders: false,
							battleStartTs: 0
						};
						this.attemptsRemaining = 1; // Only do one battle per execution due to cooldown

						if (userInfo.arenaAttempts <= 0) {
							setProgress(`${I18N('ARENA')}: No attempts remaining (${userInfo.arenaAttempts})`);
							return;
						}

						setProgress(`${I18N('ARENA')}: ${userInfo.arenaAttempts} attempts available - executing single battle`);
						return;
					}
				}
			} catch (error) {
				console.log('Could not get user info, using fallback:', error);
			}

			// Fallback to placeholder data
			console.log(`${this.arenaType === 'grand' ? 'Grand Arena' : 'Arena'} GetInfo API not available, using alternative approach`);
			this.arenaInfo = {
				attempts: 1, // Only do one battle per execution due to cooldown
				rank: 1000,  // Assume current rank
				status: 'active',
				rivals: [],  // Will be populated by getArenaOpponents
				canUpdateDefenders: false,
				battleStartTs: 0
			};
			this.attemptsRemaining = 1; // Only do one battle per execution due to cooldown
			this.opponents = [];
			setProgress(`${this.arenaType === 'grand' ? I18N('GRAND_ARENA') : I18N('ARENA')}: ${I18N('INITIALIZING')} - executing single battle...`);
			return;
		}

		this.getAvailableTeams = async function() {
			const calls = [{
				name: "teamGetAll",
				args: {},
				ident: "teamGetAll"
			}, {
				name: "teamGetFavor",
				args: {},
				ident: "teamGetFavor"
			}, {
				name: "heroGetAll",
				args: {},
				ident: "heroGetAll"
			}];

			const response = await Send(JSON.stringify({calls}));
			console.log('Team API response:', response);

			// Check if response has the expected structure
			if (!response || !response.results || response.results.length < 3) {
				throw new Error('Invalid team API response structure');
			}

			// Check each result individually
			if (!response.results[0] || !response.results[0].result || !response.results[0].result.response) {
				throw new Error('Invalid teamGetAll response');
			}
			if (!response.results[1] || !response.results[1].result || !response.results[1].result.response) {
				throw new Error('Invalid teamGetFavor response');
			}
			if (!response.results[2] || !response.results[2].result || !response.results[2].result.response) {
				throw new Error('Invalid heroGetAll response');
			}

			this.teamInfo = {
				teams: response.results[0].result.response,
				favor: response.results[1].result.response,
				heroes: Object.values(response.results[2].result.response)
			};

			console.log('Team info:', this.teamInfo);
		}

		this.getArenaOpponents = async function() {
			console.log('Getting arena opponents...');

			// Use the correct API call based on arena type
			const apiName = this.arenaType === 'grand' ? 'grandFindEnemies' : 'arenaFindEnemies';
			const calls = [{
				name: apiName,
				args: {},
				context: {
					actionTs: Date.now()
				},
				ident: "body"
			}];

			try {
				const response = await Send(JSON.stringify({calls}));
				console.log('Arena opponents API response:', response);
				console.log('Arena opponents API response details:', JSON.stringify(response, null, 2));

				if (!response || !response.results || !response.results[0] || !response.results[0].result) {
					throw new Error(`Invalid API response structure for ${apiName}`);
				}

				const opponents = response.results[0].result.response;
				console.log('Detailed opponents info:', opponents);

				// Convert array of opponents to object format for easier processing
				const opponentsMap = {};
				if (Array.isArray(opponents)) {
					opponents.forEach(opponent => {
						opponentsMap[opponent.userId] = opponent;
					});
				}

				return opponentsMap;
			} catch (error) {
				console.error('Error getting arena opponents:', error);
				// Return empty object if we can't get opponents
				return {};
			}
		}

		this.findEasiestOpponents = function() {
			// Process the opponent data from arenaFindEnemies
			if (this.opponents && typeof this.opponents === 'object') {
				const availableOpponents = [];

				// Convert the opponent data to our internal format
				for (const [opponentId, opponentData] of Object.entries(this.opponents)) {
					availableOpponents.push({
						opponent: {
							id: opponentId,
							power: parseInt(opponentData.power) || 0,
							place: parseInt(opponentData.place) || 1000,
							heroes: opponentData.heroes || [],
							banners: opponentData.banners || [],
							user: opponentData.user || {}
						},
						rank: parseInt(opponentData.place) || 1000,
						difficulty: parseInt(opponentData.power) || 0 // Use power as difficulty indicator
					});
				}

				// Sort by difficulty (easiest first - lowest power)
				this.opponents = availableOpponents.sort((a, b) => a.difficulty - b.difficulty);
				console.log('Available opponents:', this.opponents);
			} else {
				console.log('No opponents data to process');
				this.opponents = [];
			}
		}

		this.executeBattles = async function() {
			for (let i = 0; i < this.attemptsRemaining && this.opponents.length > 0; i++) {
				const opponent = this.opponents.shift();
				setProgress(`${this.arenaType === 'grand' ? I18N('GRAND_ARENA') : I18N('ARENA')}: ${I18N('BATTLE')} ${i + 1}/${this.attemptsRemaining} - Opponent ${opponent.id}`);

				try {
					// For Grand Arena, check target range first
					if (this.arenaType === 'grand') {
						const canAttack = await this.checkTargetRange(opponent.opponent.id);
						if (!canAttack) {
							console.log(`Target ${opponent.opponent.id} is not in range, skipping`);
							continue;
						}
					}

					const result = await this.executeBattle(opponent);
					if (result.win) {
						this.victories++;
					}
				} catch (error) {
					console.error('Battle error:', error);
				}
			}

			this.end(`Completed ${this.victories}/${this.attemptsRemaining} victories`);
		}

		this.executeBattle = async function(opponent) {
			try {
				// Validate opponent data
				if (!opponent || !opponent.opponent || !opponent.opponent.id) {
					console.error('Invalid opponent data:', opponent);
					return { win: false };
				}

				console.log('Executing battle against opponent:', opponent.opponent.id);

				// Get team configuration based on arena type
				const teamConfig = this.getTeamConfiguration();
				console.log('Using team configuration for battle:', teamConfig);

				// Start battle - use the opponent ID as userId
				const battleResult = await this.startArenaBattle(opponent.opponent.id, teamConfig);

				// End battle
				await this.endArenaBattle(battleResult);

				return battleResult;
			} catch (error) {
				console.error('Error in executeBattle:', error);
				return { win: false };
			}
		}

		this.checkTargetRange = async function(targetId) {
			if (this.arenaType !== 'grand') {
				return true; // Regular Arena doesn't need range check
			}

			try {
				const calls = [{
					name: "grandCheckTargetRange",
					args: {
						ids: [targetId]
					},
					context: {
						actionTs: Date.now()
					},
					ident: "body"
				}];

				const response = await Send(JSON.stringify({calls}));
				console.log('Target range check response:', response);

				if (response && response.results && response.results[0] && response.results[0].result) {
					const result = response.results[0].result.response;
					return result[targetId] === true;
				}

				return false;
			} catch (error) {
				console.error('Error checking target range:', error);
				return false;
			}
		}

		this.getTeamConfiguration = function() {
			// Use system's pre-configured teams from teamGetAll (like adventure system)
			if (!this.teamInfo || !this.teamInfo.teams) {
				console.error('Team info not available, using fallback configuration');
				return this.getFallbackTeamConfiguration();
			}

			const teamData = this.teamInfo.teams;
			const favorData = this.teamInfo.favor;

			if (this.arenaType === 'grand') {
				// Grand Arena: Use system's pre-configured grand arena teams
				const grandTeams = teamData.grand || [];
				const grandFavor = favorData.grand || {};

				console.log('Grand Arena teams from system:', grandTeams);
				console.log('Grand Arena favor from system:', grandFavor);

				// Process grand arena teams (3 teams of 6 elements each: 5 heroes + 1 pet)
				const heroes = [];
				const pets = [];

				for (let i = 0; i < grandTeams.length; i++) {
					const team = grandTeams[i];
					if (team && team.length >= 6) {
						heroes.push(team.slice(0, 5)); // First 5 are heroes
						pets.push(team[5]); // 6th element is pet
					}
				}

				return {
					heroes: heroes,
					pets: pets,
					favor: grandFavor,
					banners: [] // Will be handled by system
				};
			} else {
				// Regular Arena: Use system's pre-configured arena team
				const arenaTeam = teamData.arena || [];
				const arenaFavor = favorData.arena || {};

				console.log('Regular Arena team from system:', arenaTeam);
				console.log('Regular Arena favor from system:', arenaFavor);

				// Process arena team (6 elements: 5 heroes + 1 pet)
				let heroes = [];
				let pet = null;

				if (arenaTeam && arenaTeam.length >= 6) {
					heroes = arenaTeam.slice(0, 5); // First 5 are heroes
					pet = arenaTeam[5]; // 6th element is pet
				}

				return {
					heroes: heroes,
					pet: pet,
					favor: arenaFavor,
					banners: [] // Will be handled by system
				};
			}
		}

		this.getFallbackTeamConfiguration = function() {
			// Fallback configuration if system teams are not available
			if (this.arenaType === 'grand') {
				return {
					heroes: [
						[58, 1, 64, 13, 55],  // Team 1
						[42, 56, 9, 62, 43],  // Team 2
						[16, 31, 57, 40, 48]  // Team 3
					],
					pets: [6006, 6005, 6004],
					favor: {},
					banners: [1, 6, 2]
				};
			} else {
				return {
					heroes: [57, 31, 55, 40, 16],
					pet: 6008,
					favor: {},
					banners: [6]
				};
			}
		}

		this.getAvailableTeamsForBattle = function() {
			// Use system's pre-configured teams only (like adventure system)
			// No dynamic team selection - use what the system provides
			const teamConfig = this.getTeamConfiguration();

			return {
				current: teamConfig,
				alternatives: [] // No alternatives - use system's team only
			};
		}

		this.startArenaBattle = async function(rivalId, team) {
			// Use the correct API call based on arena type
			const apiName = this.arenaType === 'grand' ? 'grandAttack' : 'arenaAttack';

			// Prepare arguments based on arena type
			let args;
			if (this.arenaType === 'grand') {
				// Grand Arena uses different parameter structure
				args = {
					userId: rivalId,
					heroes: team.heroes,  // Array of 3 teams
					pets: team.pets,      // Array of 3 pets
					favor: team.favor,
					banners: team.banners  // Array of 3 banners
				};
			} else {
				// Regular Arena uses single team structure
				args = {
					userId: rivalId,
					heroes: team.heroes,  // Single array of 5 heroes
					pet: team.pet,        // Single pet
					favor: team.favor,
					banners: team.banners  // Single banner
				};
			}

			const calls = [{
				name: apiName,
				args: args,
				context: {
					actionTs: Date.now()
				},
				ident: "body"
			}];

			const response = await Send(JSON.stringify({calls}));
			console.log('Battle API response:', response);
			console.log('Battle API response details:', JSON.stringify(response, null, 2));

			// Check for error in response
			if (response.error) {
				const errorName = response.error.name || 'Unknown';
				const errorDesc = response.error.description || '';

				let errorMessage = `API error: ${errorName}`;
				if (errorDesc) {
					errorMessage += ` - ${errorDesc}`;
				}

				// Provide specific messages for common errors
				if (errorName === 'NotAvailable') {
					errorMessage = 'Arena not available - may be in peace time, no attempts left, or arena locked';
				} else if (errorName === 'InvalidRequest') {
					errorMessage = 'Invalid request - check opponent IDs and team configuration';
				} else if (errorName === 'ArgumentError') {
					errorMessage = 'Missing required arguments - check team data';
				}

				throw new Error(errorMessage);
			}

			// Handle Grand Arena response structure
			if (this.arenaType === 'grand') {
				// Grand Arena returns battles array and overall result
				if (response.results && response.results[0] && response.results[0].result) {
					const result = response.results[0].result.response;
					if (result.battles && result.battles.length > 0) {
						// Use the first battle for calculation
						const battleData = result.battles[0];
						return new Promise((resolve) => {
							BattleCalc(battleData, getBattleType(this.arenaType), (calcResult) => {
								if (!calcResult || !calcResult.result) {
									console.error('BattleCalc returned invalid result:', calcResult);
									resolve({
										win: false,
										progress: [],
										result: { win: false }
									});
									return;
								}
								resolve({
									win: calcResult.result.win,
									progress: calcResult.progress,
									result: calcResult.result
								});
							});
						});
					}
				}
			} else {
				// Regular Arena response handling
				let battleData = null;
				if (response.results && response.results[0]) {
					const result = response.results[0].result || response.results[0];
					if (result.response && result.response.battle) {
						battleData = result.response.battle;
					} else if (result.battle) {
						battleData = result.battle;
					} else if (result.response) {
						battleData = result.response;
					}
				}

				if (battleData) {
					return new Promise((resolve) => {
						BattleCalc(battleData, getBattleType(this.arenaType), (result) => {
							if (!result || !result.result) {
								console.error('BattleCalc returned invalid result:', result);
								resolve({
									win: false,
									progress: [],
									result: { win: false }
								});
								return;
							}
							resolve({
								win: result.result.win,
								progress: result.progress,
								result: result.result
							});
						});
					});
				}
			}

			// If no battle data found, assume success and return a simple result
			console.log('No battle data found, assuming success');
			return {
				win: true,
				progress: [],
				result: { win: true }
			};
		}

		this.endArenaBattle = async function(battleResult) {
			// Use stashClient for battle tracking as observed in the actual game
			const calls = [{
				name: "stashClient",
				args: {
					data: [{
						type: ".client.window.close",
						params: {
							actionTs: Date.now(),
							windowName: "game.view.popup.battle.BattlePausePopup",
							timestamp: Math.floor(Date.now() / 1000),
							sessionNumber: 83,
							windowCounter: 21,
							assetsReloadNum: 0,
							assetsType: "web",
							assetsLoadingPercent: 0,
							assetsLoadingTime: 0
						}
					}]
				},
				context: { actionTs: Date.now() },
				ident: "group_1_body"
			}];

			try {
				const response = await Send(JSON.stringify({calls}));
				console.log('End battle API response:', response);
			} catch (error) {
				console.error('Error ending battle:', error);
				// Don't throw here, just log the error
			}
		}

		// New method to handle stashClient API calls for battle tracking
		this.trackBattleProgress = async function(battlePhase, windowName, sessionNumber, windowCounter) {
			const calls = [{
				name: "stashClient",
				args: {
					data: [{
						type: `.client.window.${battlePhase}`,
						params: {
							actionTs: Date.now(),
							windowName: windowName,
							timestamp: Math.floor(Date.now() / 1000),
							sessionNumber: sessionNumber,
							windowCounter: windowCounter,
							assetsReloadNum: 0,
							assetsType: "web",
							assetsLoadingPercent: 0,
							assetsLoadingTime: 0
						}
					}]
				},
				context: { actionTs: Date.now() },
				ident: "group_0_body"
			}];

			try {
				const response = await Send(JSON.stringify({calls}));
				console.log('StashClient API response:', response);
				return response;
			} catch (error) {
				console.error('Error tracking battle progress:', error);
				return null;
			}
		}

		this.end = function(message) {
			console.log('Arena execution ended:', message);
			setProgress(`${I18N('ARENA')}: ${message}`, true);
			this.resolve();
		}
	}

	/**
	 * Wrapper functions for arena battles
	 *
	 * Функции-обертки для битв арены
	 */

	function testArena() {
		const { executeArena } = HWHClasses;
		return new Promise((resolve, reject) => {
			const arena = new executeArena(resolve, reject);
			arena.start('arena');
		});
	}

	function testGrandArena() {
		const { executeArena } = HWHClasses;
		return new Promise((resolve, reject) => {
			const arena = new executeArena(resolve, reject);
			arena.start('grand');
		});
	}

	function testBothArenas() {
		return new Promise(async (resolve, reject) => {
			try {
				// Try Arena first
				try {
					await testArena();
				} catch (error) {
					console.log('Arena not available:', error.message);
					// Continue to Grand Arena even if regular Arena fails
				}

				// Try Grand Arena
				try {
					await testGrandArena();
				} catch (error) {
					console.log('Grand Arena not available:', error.message);
					// Continue even if Grand Arena fails
				}

				resolve();
			} catch (error) {
				reject(error);
			}
		});
	}

	this.HWHClasses.executeTitanArena = executeTitanArena;
	this.HWHClasses.executeArena = executeArena;
	this.HWHClasses.executeGuildWar = executeGuildWar;

	/**
	 * Guild War auto-attack execution
	 *
	 * Автоматическая атака гильдии войны
	 */
	function executeGuildWar(resolve, reject) {
		this.resolve = resolve;
		this.reject = reject;
		this.attemptsRemaining = 0;
		this.victories = 0;
		this.guildWarInfo = null;
		this.teamInfo = null;
		this.slots = [];
		this.currentSlot = 1;

		this.start = async function() {
			setProgress(`${I18N('GUILD_WAR')}: ${I18N('INITIALIZING')}...`);

			try {
				// Get team data for attacks
				await this.getTeamData();

				// Directly attack slots 1 and 2
				await this.attackDirectSlots();
			} catch (error) {
				console.error('Guild War error:', error);
				this.end(`Error: ${error.message}`);
			}
		}


		this.getTeamData = async function() {
			console.log('Getting team data...');
			
			const calls = [
				{
					name: "teamGetAll",
					args: {},
					context: { actionTs: Date.now() },
					ident: "teamGetAll"
				},
				{
					name: "teamGetFavor",
					args: {},
					context: { actionTs: Date.now() },
					ident: "teamGetFavor"
				},
				{
					name: "heroGetAll",
					args: {},
					context: { actionTs: Date.now() },
					ident: "heroGetAll"
				}
			];

			const response = await Send(JSON.stringify({calls}));
			
			// Check for API errors
			if (response.error) {
				throw new Error(`Team data API error: ${response.error.name} - ${response.error.description}`);
			}
			
			if (!response.results[0] || !response.results[0].result || !response.results[0].result.response) {
				throw new Error('Invalid teamGetAll response - team data not available');
			}
			if (!response.results[1] || !response.results[1].result || !response.results[1].result.response) {
				throw new Error('Invalid teamGetFavor response - favor data not available');
			}
			if (!response.results[2] || !response.results[2].result || !response.results[2].result.response) {
				throw new Error('Invalid heroGetAll response - hero data not available');
			}

			this.teamInfo = {
				teams: response.results[0].result.response,
				favor: response.results[1].result.response,
				heroes: Object.values(response.results[2].result.response)
			};

			console.log('Team data loaded');
		}

		this.attackDirectSlots = async function() {
			console.log('Starting direct Guild War attacks on slots 1 and 2...');
			
			// Attack slot 1
			try {
				console.log('Attacking slot 1...');
				setProgress(`${I18N('GUILD_WAR')}: Attacking slot 1`);
				await this.attackSlot(1);
				this.victories++;
				console.log('Slot 1 attack completed successfully');
			} catch (error) {
				console.error('Error attacking slot 1:', error);
				this.end(`Slot 1 attack failed: ${error.message}`);
				return;
			}

			// Small delay between attacks
			await new Promise(resolve => setTimeout(resolve, 1000));

			// Attack slot 2
			try {
				console.log('Attacking slot 2...');
				setProgress(`${I18N('GUILD_WAR')}: Attacking slot 2`);
				await this.attackSlot(2);
				this.victories++;
				console.log('Slot 2 attack completed successfully');
			} catch (error) {
				console.error('Error attacking slot 2:', error);
				this.end(`Slot 2 attack failed: ${error.message}`);
				return;
			}

			this.end(`Completed ${this.victories} Guild War attacks`);
		}

		this.attackSlot = async function(slotId) {
			console.log(`Attacking slot ${slotId}...`);
			
			// Get arena team configuration (same as arena attack)
			const teamConfig = this.getArenaTeamConfiguration();
			
			if (!teamConfig.heroes || teamConfig.heroes.length < 5) {
				throw new Error('Arena team not properly configured - need at least 5 heroes');
			}

			// Prepare attack request using arena team structure
			const calls = [
				{
					name: "clanWarAttack",
					args: {
						slotId: slotId,
						heroes: teamConfig.heroes.slice(0, 5), // Take first 5 heroes
						pet: teamConfig.pet,
						favor: teamConfig.favor,
						banner: teamConfig.banners && teamConfig.banners.length > 0 ? teamConfig.banners[0] : 1
					},
					context: {
						actionTs: Date.now()
					},
					ident: "body"
				}
			];

			const response = await Send(JSON.stringify({calls}));
			
			// Check for API errors
			if (response.error) {
				// Handle specific Guild War errors
				if (response.error.name === 'NotAvailable') {
					throw new Error('Guild War is not currently available');
				} else if (response.error.name === 'InvalidRequest') {
					throw new Error('Invalid attack request - check team configuration');
				} else if (response.error.name === 'ArgumentError') {
					throw new Error('Missing required attack arguments');
				} else if (response.error.name === 'NotFound') {
					throw new Error(`Target slot ${slotId} not found`);
				} else {
					throw new Error(`Attack failed: ${response.error.name} - ${response.error.description}`);
				}
			}

			// Check if the response contains results
			if (!response.results || !response.results[0]) {
				throw new Error('Invalid attack response - no results received');
			}

			const result = response.results[0].result;
			if (!result) {
				throw new Error('Invalid attack response - no result data');
			}

			console.log(`Slot ${slotId} attack completed successfully`);
			return result;
		}

		this.getArenaTeamConfiguration = function() {
			// Use the same team configuration logic as arena attack
			if (!this.teamInfo || !this.teamInfo.teams) {
				console.error('Team info not available, using fallback configuration');
				return this.getFallbackTeamConfiguration();
			}

			const teamData = this.teamInfo.teams;
			const favorData = this.teamInfo.favor;

			// Use arena team configuration (same as regular arena)
			const arenaTeam = teamData.arena || [];
			const arenaFavor = favorData.arena || {};

			console.log('Arena team from system:', arenaTeam);
			console.log('Arena favor from system:', arenaFavor);

			// Process arena team (6 elements: 5 heroes + 1 pet)
			let heroes = [];
			let pet = null;

			if (arenaTeam && arenaTeam.length >= 6) {
				heroes = arenaTeam.slice(0, 5); // First 5 are heroes
				pet = arenaTeam[5]; // 6th element is pet
			}

			return {
				heroes: heroes,
				pet: pet,
				favor: arenaFavor,
				banners: [] // Will be handled by system
			};
		}

		this.getFallbackTeamConfiguration = function() {
			// Fallback configuration if team data is not available
			console.log('Using fallback team configuration');
			return {
				heroes: [46, 57, 40, 16, 65], // Default hero team
				pet: 6004, // Default pet
				favor: {}, // No favor assignments
				banners: []
			};
		}


		this.end = function(reason) {
			setProgress(`${I18N('GUILD_WAR')}: ${reason}`, true);
			console.log('Guild War completed:', reason);
			this.resolve();
		}
	}

	/**
	 * Wrapper function for Guild War battles
	 *
	 * Функция-обертка для битв гильдии войны
	 */
	function testGuildWar() {
		const { executeGuildWar } = HWHClasses;
		return new Promise((resolve, reject) => {
			const guildWar = new executeGuildWar(resolve, reject);
			guildWar.start();
		});
	}

	function hackGame() {
		const self = this;
		selfGame = null;
		bindId = 1e9;
		this.libGame = null;
		this.doneLibLoad = () => {};

		/**
		 * List of correspondence of used classes to their names
		 *
		 * Список соответствия используемых классов их названиям
		 */
		ObjectsList = [
			{ name: 'BattlePresets', prop: 'game.battle.controller.thread.BattlePresets' },
			{ name: 'DataStorage', prop: 'game.data.storage.DataStorage' },
			{ name: 'BattleConfigStorage', prop: 'game.data.storage.battle.BattleConfigStorage' },
			{ name: 'BattleInstantPlay', prop: 'game.battle.controller.instant.BattleInstantPlay' },
			{ name: 'MultiBattleInstantReplay', prop: 'game.battle.controller.instant.MultiBattleInstantReplay' },
			{ name: 'MultiBattleResult', prop: 'game.battle.controller.MultiBattleResult' },

			{ name: 'PlayerMissionData', prop: 'game.model.user.mission.PlayerMissionData' },
			{ name: 'PlayerMissionBattle', prop: 'game.model.user.mission.PlayerMissionBattle' },
			{ name: 'GameModel', prop: 'game.model.GameModel' },
			{ name: 'CommandManager', prop: 'game.command.CommandManager' },
			{ name: 'MissionCommandList', prop: 'game.command.rpc.mission.MissionCommandList' },
			{ name: 'RPCCommandBase', prop: 'game.command.rpc.RPCCommandBase' },
			{ name: 'PlayerTowerData', prop: 'game.model.user.tower.PlayerTowerData' },
			{ name: 'TowerCommandList', prop: 'game.command.tower.TowerCommandList' },
			{ name: 'PlayerHeroTeamResolver', prop: 'game.model.user.hero.PlayerHeroTeamResolver' },
			{ name: 'BattlePausePopup', prop: 'game.view.popup.battle.BattlePausePopup' },
			{ name: 'BattlePopup', prop: 'game.view.popup.battle.BattlePopup' },
			{ name: 'DisplayObjectContainer', prop: 'starling.display.DisplayObjectContainer' },
			{ name: 'GuiClipContainer', prop: 'engine.core.clipgui.GuiClipContainer' },
			{ name: 'BattlePausePopupClip', prop: 'game.view.popup.battle.BattlePausePopupClip' },
			{ name: 'ClipLabel', prop: 'game.view.gui.components.ClipLabel' },
			{ name: 'ClipLabelBase', prop: 'game.view.gui.components.ClipLabelBase' },
			{ name: 'Translate', prop: 'com.progrestar.common.lang.Translate' },
			{ name: 'ClipButtonLabeledCentered', prop: 'game.view.gui.components.ClipButtonLabeledCentered' },
			{ name: 'BattlePausePopupMediator', prop: 'game.mediator.gui.popup.battle.BattlePausePopupMediator' },
			{ name: 'SettingToggleButton', prop: 'game.mechanics.settings.popup.view.SettingToggleButton' },
			{ name: 'PlayerDungeonData', prop: 'game.mechanics.dungeon.model.PlayerDungeonData' },
			{ name: 'NextDayUpdatedManager', prop: 'game.model.user.NextDayUpdatedManager' },
			{ name: 'BattleController', prop: 'game.battle.controller.BattleController' },
			{ name: 'BattleSettingsModel', prop: 'game.battle.controller.BattleSettingsModel' },
			{ name: 'BooleanProperty', prop: 'engine.core.utils.property.BooleanProperty' },
			{ name: 'RuleStorage', prop: 'game.data.storage.rule.RuleStorage' },
			{ name: 'BattleConfig', prop: 'battle.BattleConfig' },
			{ name: 'BattleGuiMediator', prop: 'game.battle.gui.BattleGuiMediator' },
			{ name: 'BooleanPropertyWriteable', prop: 'engine.core.utils.property.BooleanPropertyWriteable' },
			{ name: 'BattleLogEncoder', prop: 'battle.log.BattleLogEncoder' },
			{ name: 'BattleLogReader', prop: 'battle.log.BattleLogReader' },
			{ name: 'PlayerSubscriptionInfoValueObject', prop: 'game.model.user.subscription.PlayerSubscriptionInfoValueObject' },
			{ name: 'AdventureMapCamera', prop: 'game.mechanics.adventure.popup.map.AdventureMapCamera' },
		];

		/**
		 * Contains the game classes needed to write and override game methods
		 *
		 * Содержит классы игры необходимые для написания и подмены методов игры
		 */
		Game = {
			/**
			 * Function 'e'
			 * Функция 'e'
			 */
			bindFunc: function (a, b) {
				if (null == b) return null;
				null == b.__id__ && (b.__id__ = bindId++);
				var c;
				null == a.hx__closures__ ? (a.hx__closures__ = {}) : (c = a.hx__closures__[b.__id__]);
				null == c && ((c = b.bind(a)), (a.hx__closures__[b.__id__] = c));
				return c;
			},
		};

		/**
		 * Connects to game objects via the object creation event
		 *
		 * Подключается к объектам игры через событие создания объекта
		 */
		function connectGame() {
			for (let obj of ObjectsList) {
				/**
				 * https: //stackoverflow.com/questions/42611719/how-to-intercept-and-modify-a-specific-property-for-any-object
				 */
				Object.defineProperty(Object.prototype, obj.prop, {
					set: function (value) {
						if (!selfGame) {
							selfGame = this;
						}
						if (!Game[obj.name]) {
							Game[obj.name] = value;
						}
						// console.log('set ' + obj.prop, this, value);
						this[obj.prop + '_'] = value;
					},
					get: function () {
						// console.log('get ' + obj.prop, this);
						return this[obj.prop + '_'];
					},
				});
			}
		}

		/**
		 * Game.BattlePresets
		 * @param {bool} a isReplay
		 * @param {bool} b autoToggleable
		 * @param {bool} c auto On Start
		 * @param {object} d config
		 * @param {bool} f showBothTeams
		 */
		/**
		 * Returns the results of the battle to the callback function
		 * Возвращает в функцию callback результаты боя
		 * @param {*} battleData battle data данные боя
		 * @param {*} battleConfig combat configuration type options:
		 *
		 * тип конфигурации боя варианты:
		 *
		 * "get_invasion", "get_titanPvpManual", "get_titanPvp",
		 * "get_titanClanPvp","get_clanPvp","get_titan","get_boss",
		 * "get_tower","get_pve","get_pvpManual","get_pvp","get_core"
		 *
		 * You can specify the xYc function in the game.assets.storage.BattleAssetStorage class
		 *
		 * Можно уточнить в классе game.assets.storage.BattleAssetStorage функция xYc
		 * @param {*} callback функция в которую вернуться результаты боя
		 */
		this.BattleCalc = function (battleData, battleConfig, callback) {
			// battleConfig = battleConfig || getBattleType(battleData.type)
			if (!Game.BattlePresets) throw Error('Use connectGame');
			battlePresets = new Game.BattlePresets(
				battleData.progress,
				!1,
				!0,
				Game.DataStorage[getFn(Game.DataStorage, 24)][getF(Game.BattleConfigStorage, battleConfig)](),
				!1
			);
			let battleInstantPlay;
			if (battleData.progress?.length > 1) {
				battleInstantPlay = new Game.MultiBattleInstantReplay(battleData, battlePresets);
			} else {
				battleInstantPlay = new Game.BattleInstantPlay(battleData, battlePresets);
			}
			battleInstantPlay[getProtoFn(Game.BattleInstantPlay, 9)].add((battleInstant) => {
				const MBR_2 = getProtoFn(Game.MultiBattleResult, 2);
				const battleResults = battleInstant[getF(Game.BattleInstantPlay, 'get_result')]();
				const battleData = battleInstant[getF(Game.BattleInstantPlay, 'get_rawBattleInfo')]();
				const battleLogs = [];
				const timeLimit = battlePresets[getF(Game.BattlePresets, 'get_timeLimit')]();
				let battleTime = 0;
				let battleTimer = 0;
				for (const battleResult of battleResults[MBR_2]) {
					const battleLog = Game.BattleLogEncoder.read(new Game.BattleLogReader(battleResult));
					battleLogs.push(battleLog);
					const maxTime = Math.max(...battleLog.map((e) => (e.time < timeLimit && e.time !== 168.8 ? e.time : 0)));
					battleTimer += getTimer(maxTime);
					battleTime += maxTime;
				}
				callback({
					battleLogs,
					battleTime,
					battleTimer,
					battleData,
					progress: battleResults[getF(Game.MultiBattleResult, 'get_progress')](),
					result: battleResults[getF(Game.MultiBattleResult, 'get_result')](),
				});
			});
			battleInstantPlay.start();
		};

		/**
		 * Returns a function with the specified name from the class
		 *
		 * Возвращает из класса функцию с указанным именем
		 * @param {Object} classF Class // класс
		 * @param {String} nameF function name // имя функции
		 * @param {String} pos name and alias order // порядок имени и псевдонима
		 * @returns
		 */
		function getF(classF, nameF, pos) {
			pos = pos || false;
			let prop = Object.entries(classF.prototype.__properties__);
			if (!pos) {
				return prop.filter((e) => e[1] == nameF).pop()[0];
			} else {
				return prop.filter((e) => e[0] == nameF).pop()[1];
			}
		}

		/**
		 * Returns a function with the specified name from the class
		 *
		 * Возвращает из класса функцию с указанным именем
		 * @param {Object} classF Class // класс
		 * @param {String} nameF function name // имя функции
		 * @returns
		 */
		function getFnP(classF, nameF) {
			let prop = Object.entries(classF.__properties__);
			return prop.filter((e) => e[1] == nameF).pop()[0];
		}

		/**
		 * Returns the function name with the specified ordinal from the class
		 *
		 * Возвращает имя функции с указаным порядковым номером из класса
		 * @param {Object} classF Class // класс
		 * @param {Number} nF Order number of function // порядковый номер функции
		 * @returns
		 */
		function getFn(classF, nF) {
			let prop = Object.keys(classF);
			return prop[nF];
		}

		/**
		 * Returns the name of the function with the specified serial number from the prototype of the class
		 *
		 * Возвращает имя функции с указаным порядковым номером из прототипа класса
		 * @param {Object} classF Class // класс
		 * @param {Number} nF Order number of function // порядковый номер функции
		 * @returns
		 */
		function getProtoFn(classF, nF) {
			let prop = Object.keys(classF.prototype);
			return prop[nF];
		}

		function findInstanceOf(obj, targetClass) {
			const prototypeKeys = Object.keys(Object.getPrototypeOf(obj));
			const matchingKey = prototypeKeys.find((key) => obj[key] instanceof targetClass);
			return matchingKey ? obj[matchingKey] : null;
		}
		/**
		 * Description of replaced functions
		 *
		 * Описание подменяемых функций
		 */
		replaceFunction = {
			company: function () {
				let PMD_12 = getProtoFn(Game.PlayerMissionData, 12);
				let oldSkipMisson = Game.PlayerMissionData.prototype[PMD_12];
				Game.PlayerMissionData.prototype[PMD_12] = function (a, b, c) {
					if (!isChecked('passBattle')) {
						oldSkipMisson.call(this, a, b, c);
						return;
					}

					try {
						this[getProtoFn(Game.PlayerMissionData, 9)] = new Game.PlayerMissionBattle(a, b, c);

						var a = new Game.BattlePresets(
							!1,
							!1,
							!0,
							Game.DataStorage[getFn(Game.DataStorage, 24)][getProtoFn(Game.BattleConfigStorage, 20)](),
							!1
						);
						a = new Game.BattleInstantPlay(c, a);
						a[getProtoFn(Game.BattleInstantPlay, 9)].add(Game.bindFunc(this, this.P$h));
						a.start();
					} catch (error) {
						console.error('company', error);
						oldSkipMisson.call(this, a, b, c);
					}
				};

				Game.PlayerMissionData.prototype.P$h = function (a) {
					let GM_2 = getFn(Game.GameModel, 2);
					let GM_P2 = getProtoFn(Game.GameModel, 2);
					let CM_21 = getProtoFn(Game.CommandManager, 21);
					let MCL_2 = getProtoFn(Game.MissionCommandList, 2);
					let MBR_15 = getF(Game.MultiBattleResult, 'get_result');
					let RPCCB_17 = getProtoFn(Game.RPCCommandBase, 17);
					let PMD_34 = getProtoFn(Game.PlayerMissionData, 34);
					Game.GameModel[GM_2]()[GM_P2][CM_21][MCL_2](a[MBR_15]())[RPCCB_17](Game.bindFunc(this, this[PMD_34]));
				};
			},
			/*
			tower: function () {
				let PTD_67 = getProtoFn(Game.PlayerTowerData, 67);
				let oldSkipTower = Game.PlayerTowerData.prototype[PTD_67];
				Game.PlayerTowerData.prototype[PTD_67] = function (a) {
					if (!isChecked('passBattle')) {
						oldSkipTower.call(this, a);
						return;
					}
					try {
						var p = new Game.BattlePresets(
							!1,
							!1,
							!0,
							Game.DataStorage[getFn(Game.DataStorage, 24)][getProtoFn(Game.BattleConfigStorage, 20)](),
							!1
						);
						a = new Game.BattleInstantPlay(a, p);
						a[getProtoFn(Game.BattleInstantPlay, 9)].add(Game.bindFunc(this, this.P$h));
						a.start();
					} catch (error) {
						console.error('tower', error);
						oldSkipMisson.call(this, a, b, c);
					}
				};

				Game.PlayerTowerData.prototype.P$h = function (a) {
					const GM_2 = getFnP(Game.GameModel, 'get_instance');
					const GM_P2 = getProtoFn(Game.GameModel, 2);
					const CM_29 = getProtoFn(Game.CommandManager, 29);
					const TCL_5 = getProtoFn(Game.TowerCommandList, 5);
					const MBR_15 = getF(Game.MultiBattleResult, 'get_result');
					const RPCCB_15 = getProtoFn(Game.RPCCommandBase, 17);
					const PTD_78 = getProtoFn(Game.PlayerTowerData, 78);
					Game.GameModel[GM_2]()[GM_P2][CM_29][TCL_5](a[MBR_15]())[RPCCB_15](Game.bindFunc(this, this[PTD_78]));
				};
			},
			*/
			// skipSelectHero: function() {
			// 	if (!HOST) throw Error('Use connectGame');
			// 	Game.PlayerHeroTeamResolver.prototype[getProtoFn(Game.PlayerHeroTeamResolver, 3)] = () => false;
			// },
			passBattle: function () {
				let BPP_4 = getProtoFn(Game.BattlePausePopup, 4);
				let oldPassBattle = Game.BattlePausePopup.prototype[BPP_4];
				Game.BattlePausePopup.prototype[BPP_4] = function (a) {
					if (!isChecked('passBattle')) {
						oldPassBattle.call(this, a);
						return;
					}
					try {
						Game.BattlePopup.prototype[getProtoFn(Game.BattlePausePopup, 4)].call(this, a);
						this[getProtoFn(Game.BattlePausePopup, 3)]();
						this[getProtoFn(Game.DisplayObjectContainer, 3)](this.clip[getProtoFn(Game.GuiClipContainer, 2)]());
						this.clip[getProtoFn(Game.BattlePausePopupClip, 1)][getProtoFn(Game.ClipLabelBase, 9)](
							Game.Translate.translate('UI_POPUP_BATTLE_PAUSE')
						);

						this.clip[getProtoFn(Game.BattlePausePopupClip, 2)][getProtoFn(Game.ClipButtonLabeledCentered, 2)](
							Game.Translate.translate('UI_POPUP_BATTLE_RETREAT'),
							((q = this[getProtoFn(Game.BattlePausePopup, 1)]), Game.bindFunc(q, q[getProtoFn(Game.BattlePausePopupMediator, 17)]))
						);
						this.clip[getProtoFn(Game.BattlePausePopupClip, 5)][getProtoFn(Game.ClipButtonLabeledCentered, 2)](
							this[getProtoFn(Game.BattlePausePopup, 1)][getProtoFn(Game.BattlePausePopupMediator, 14)](),
							this[getProtoFn(Game.BattlePausePopup, 1)][getProtoFn(Game.BattlePausePopupMediator, 13)]()
								? ((q = this[getProtoFn(Game.BattlePausePopup, 1)]), Game.bindFunc(q, q[getProtoFn(Game.BattlePausePopupMediator, 18)]))
								: ((q = this[getProtoFn(Game.BattlePausePopup, 1)]), Game.bindFunc(q, q[getProtoFn(Game.BattlePausePopupMediator, 18)]))
						);

						this.clip[getProtoFn(Game.BattlePausePopupClip, 5)][getProtoFn(Game.ClipButtonLabeledCentered, 0)][
							getProtoFn(Game.ClipLabelBase, 24)
						]();
						this.clip[getProtoFn(Game.BattlePausePopupClip, 3)][getProtoFn(Game.SettingToggleButton, 3)](
							this[getProtoFn(Game.BattlePausePopup, 1)][getProtoFn(Game.BattlePausePopupMediator, 9)]()
						);
						this.clip[getProtoFn(Game.BattlePausePopupClip, 4)][getProtoFn(Game.SettingToggleButton, 3)](
							this[getProtoFn(Game.BattlePausePopup, 1)][getProtoFn(Game.BattlePausePopupMediator, 10)]()
						);
						this.clip[getProtoFn(Game.BattlePausePopupClip, 6)][getProtoFn(Game.SettingToggleButton, 3)](
							this[getProtoFn(Game.BattlePausePopup, 1)][getProtoFn(Game.BattlePausePopupMediator, 11)]()
						);
					} catch (error) {
						console.error('passBattle', error);
						oldPassBattle.call(this, a);
					}
				};

				let retreatButtonLabel = getF(Game.BattlePausePopupMediator, 'get_retreatButtonLabel');
				let oldFunc = Game.BattlePausePopupMediator.prototype[retreatButtonLabel];
				Game.BattlePausePopupMediator.prototype[retreatButtonLabel] = function () {
					if (isChecked('passBattle')) {
						return I18N('BTN_PASS');
					} else {
						return oldFunc.call(this);
					}
				};
			},
			endlessCards: function () {
				let PDD_21 = getProtoFn(Game.PlayerDungeonData, 21);
				let oldEndlessCards = Game.PlayerDungeonData.prototype[PDD_21];
				Game.PlayerDungeonData.prototype[PDD_21] = function () {
					if (HWHData.countPredictionCard <= 0) {
						return true;
					} else {
						return oldEndlessCards.call(this);
					}
				};
			},
			speedBattle: function () {
				const get_timeScale = getF(Game.BattleController, 'get_timeScale');
				const oldSpeedBattle = Game.BattleController.prototype[get_timeScale];
				Game.BattleController.prototype[get_timeScale] = function () {
					const speedBattle = Number.parseFloat(getInput('speedBattle'));
					if (!speedBattle) {
						return oldSpeedBattle.call(this);
					}
					try {
						const BC_12 = getProtoFn(Game.BattleController, 12);
						const BSM_12 = getProtoFn(Game.BattleSettingsModel, 12);
						const BP_get_value = getF(Game.BooleanProperty, 'get_value');
						if (this[BC_12][BSM_12][BP_get_value]()) {
							return 0;
						}
						const BSM_2 = getProtoFn(Game.BattleSettingsModel, 2);
						const BC_49 = getProtoFn(Game.BattleController, 49);
						const BSM_1 = getProtoFn(Game.BattleSettingsModel, 1);
						const BC_14 = getProtoFn(Game.BattleController, 14);
						const BC_3 = getFn(Game.BattleController, 3);
						if (this[BC_12][BSM_2][BP_get_value]()) {
							var a = speedBattle * this[BC_49]();
						} else {
							a = this[BC_12][BSM_1][BP_get_value]();
							const maxSpeed = Math.max(...this[BC_14]);
							const multiple = a == this[BC_14].indexOf(maxSpeed) ? (maxSpeed >= 4 ? speedBattle : this[BC_14][a]) : this[BC_14][a];
							a = multiple * Game.BattleController[BC_3][BP_get_value]() * this[BC_49]();
						}
						const BSM_24 = getProtoFn(Game.BattleSettingsModel, 24);
						a > this[BC_12][BSM_24][BP_get_value]() && (a = this[BC_12][BSM_24][BP_get_value]());
						const DS_23 = getFn(Game.DataStorage, 23);
						const get_battleSpeedMultiplier = getF(Game.RuleStorage, 'get_battleSpeedMultiplier', true);
						var b = Game.DataStorage[DS_23][get_battleSpeedMultiplier]();
						const R_1 = getFn(selfGame.Reflect, 1);
						const BC_1 = getFn(Game.BattleController, 1);
						const get_config = getF(Game.BattlePresets, 'get_config');
						null != b &&
							(a = selfGame.Reflect[R_1](b, this[BC_1][get_config]().ident)
								? a * selfGame.Reflect[R_1](b, this[BC_1][get_config]().ident)
								: a * selfGame.Reflect[R_1](b, 'default'));
						return a;
					} catch (error) {
						console.error('passBatspeedBattletle', error);
						return oldSpeedBattle.call(this);
					}
				};
			},

			/**
			 * Acceleration button without Valkyries favor
			 *
			 * Кнопка ускорения без Покровительства Валькирий
			 */
			battleFastKey: function () {
				const BGM_44 = getProtoFn(Game.BattleGuiMediator, 44);
				const oldBattleFastKey = Game.BattleGuiMediator.prototype[BGM_44];
				Game.BattleGuiMediator.prototype[BGM_44] = function () {
					let flag = true;
					//console.log(flag)
					if (!flag) {
						return oldBattleFastKey.call(this);
					}
					try {
						const BGM_9 = getProtoFn(Game.BattleGuiMediator, 9);
						const BGM_10 = getProtoFn(Game.BattleGuiMediator, 10);
						const BPW_0 = getProtoFn(Game.BooleanPropertyWriteable, 0);
						this[BGM_9][BPW_0](true);
						this[BGM_10][BPW_0](true);
					} catch (error) {
						console.error(error);
						return oldBattleFastKey.call(this);
					}
				};
			},
			fastSeason: function () {
				const GameNavigator = selfGame['game.screen.navigator.GameNavigator'];
				const oldFuncName = getProtoFn(GameNavigator, 18);
				const newFuncName = getProtoFn(GameNavigator, 16);
				const oldFastSeason = GameNavigator.prototype[oldFuncName];
				const newFastSeason = GameNavigator.prototype[newFuncName];
				GameNavigator.prototype[oldFuncName] = function (a, b) {
					if (isChecked('fastSeason')) {
						return newFastSeason.apply(this, [a]);
					} else {
						return oldFastSeason.apply(this, [a, b]);
					}
				};
			},
			ShowChestReward: function () {
				const TitanArtifactChest = selfGame['game.mechanics.titan_arena.mediator.chest.TitanArtifactChestRewardPopupMediator'];
				const getOpenAmountTitan = getF(TitanArtifactChest, 'get_openAmount');
				const oldGetOpenAmountTitan = TitanArtifactChest.prototype[getOpenAmountTitan];
				TitanArtifactChest.prototype[getOpenAmountTitan] = function () {
					if (correctShowOpenArtifact) {
						correctShowOpenArtifact--;
						return 100;
					}
					return oldGetOpenAmountTitan.call(this);
				};

				const ArtifactChest = selfGame['game.view.popup.artifactchest.rewardpopup.ArtifactChestRewardPopupMediator'];
				const getOpenAmount = getF(ArtifactChest, 'get_openAmount');
				const oldGetOpenAmount = ArtifactChest.prototype[getOpenAmount];
				ArtifactChest.prototype[getOpenAmount] = function () {
					if (correctShowOpenArtifact) {
						correctShowOpenArtifact--;
						return 100;
					}
					return oldGetOpenAmount.call(this);
				};
			},
			fixCompany: function () {
				const GameBattleView = selfGame['game.mediator.gui.popup.battle.GameBattleView'];
				const BattleThread = selfGame['game.battle.controller.thread.BattleThread'];
				const getOnViewDisposed = getF(BattleThread, 'get_onViewDisposed');
				const getThread = getF(GameBattleView, 'get_thread');
				const oldFunc = GameBattleView.prototype[getThread];
				GameBattleView.prototype[getThread] = function () {
					return (
						oldFunc.call(this) || {
							[getOnViewDisposed]: async () => {},
						}
					);
				};
			},
			BuyTitanArtifact: function () {
				const BIP_4 = getProtoFn(selfGame['game.view.popup.shop.buy.BuyItemPopup'], 4);
				const BuyItemPopup = selfGame['game.view.popup.shop.buy.BuyItemPopup'];
				const oldFunc = BuyItemPopup.prototype[BIP_4];
				BuyItemPopup.prototype[BIP_4] = function () {
					if (isChecked('countControl')) {
						const BuyTitanArtifactItemPopup = selfGame['game.view.popup.shop.buy.BuyTitanArtifactItemPopup'];
						const BTAP_0 = getProtoFn(BuyTitanArtifactItemPopup, 0);
						if (this[BTAP_0]) {
							const BuyTitanArtifactPopupMediator = selfGame['game.mediator.gui.popup.shop.buy.BuyTitanArtifactItemPopupMediator'];
							const BTAM_1 = getProtoFn(BuyTitanArtifactPopupMediator, 1);
							const BuyItemPopupMediator = selfGame['game.mediator.gui.popup.shop.buy.BuyItemPopupMediator'];
							const BIPM_5 = getProtoFn(BuyItemPopupMediator, 5);
							const BIPM_7 = getProtoFn(BuyItemPopupMediator, 7);
							const BIPM_9 = getProtoFn(BuyItemPopupMediator, 9);

							let need = Math.min(this[BTAP_0][BTAM_1](), this[BTAP_0][BIPM_7]);
							need = need ? need : 60;
							this[BTAP_0][BIPM_9] = need;
							this[BTAP_0][BIPM_5] = 10;
						}
					}
					oldFunc.call(this);
				};
			},
			ClanQuestsFastFarm: function () {
				const VipRuleValueObject = selfGame['game.data.storage.rule.VipRuleValueObject'];
				const getClanQuestsFastFarm = getF(VipRuleValueObject, 'get_clanQuestsFastFarm', 1);
				VipRuleValueObject.prototype[getClanQuestsFastFarm] = function () {
					return 0;
				};
			},
			adventureCamera: function () {
				const AMC_40 = getProtoFn(Game.AdventureMapCamera, 40);
				const AMC_5 = getProtoFn(Game.AdventureMapCamera, 5);
				const oldFunc = Game.AdventureMapCamera.prototype[AMC_40];
				Game.AdventureMapCamera.prototype[AMC_40] = function (a) {
					this[AMC_5] = 0.4;
					oldFunc.bind(this)(a);
				};
			},
			unlockMission: function () {
				const WorldMapStoryDrommerHelper = selfGame['game.mediator.gui.worldmap.WorldMapStoryDrommerHelper'];
				const WMSDH_4 = getFn(WorldMapStoryDrommerHelper, 4);
				const WMSDH_7 = getFn(WorldMapStoryDrommerHelper, 7);
				WorldMapStoryDrommerHelper[WMSDH_4] = function () {
					return true;
				};
				WorldMapStoryDrommerHelper[WMSDH_7] = function () {
					return true;
				};
			},
			doublePets: function () {
				const TeamGatherPopupMediator = selfGame['game.mediator.gui.popup.team.TeamGatherPopupMediator'];
				const InvasionBossTeamGatherPopupMediator = selfGame['game.mechanics.invasion.mediator.boss.InvasionBossTeamGatherPopupMediator'];
				const TeamGatherPopupHeroValueObject = selfGame['game.mediator.gui.popup.team.TeamGatherPopupHeroValueObject'];
				const ObjectPropertyWriteable = selfGame['engine.core.utils.property.ObjectPropertyWriteable'];
				const TGPM_8 = getProtoFn(TeamGatherPopupMediator, 8);
				const TGPM_45 = getProtoFn(TeamGatherPopupMediator, 45);
				const TGPM_114 = getProtoFn(TeamGatherPopupMediator, 114);
				const TGPM_117 = getProtoFn(TeamGatherPopupMediator, 117);
				const TGPM_123 = getProtoFn(TeamGatherPopupMediator, 123);
				const TGPM_135 = getProtoFn(TeamGatherPopupMediator, 135);
				const TGPHVO_40 = getProtoFn(TeamGatherPopupHeroValueObject, 40);
				const OPW_0 = getProtoFn(ObjectPropertyWriteable, 0);
				const oldFunc = InvasionBossTeamGatherPopupMediator.prototype[TGPM_135];
				InvasionBossTeamGatherPopupMediator.prototype[TGPM_135] = function (a, b) {
					try {
						if (b == 0) {
							this[TGPM_8].remove(a);
						} else {
							this[TGPM_8].F[a] = b;
						}
						this[TGPM_114](this[TGPM_45], a)[TGPHVO_40][OPW_0](this[TGPM_117](b));
						this[TGPM_123]();
						return;
					} catch (e) {}
					oldFunc.call(this, a, b);
				};
			},
		};

		/**
		 * Starts replacing recorded functions
		 *
		 * Запускает замену записанных функций
		 */
		this.activateHacks = function () {
			if (!selfGame) throw Error('Use connectGame');
			for (let func in replaceFunction) {
				try {
					replaceFunction[func]();
				} catch (error) {
					console.error(error);
				}
			}
		};

		/**
		 * Returns the game object
		 *
		 * Возвращает объект игры
		 */
		this.getSelfGame = function () {
			return selfGame;
		};

		/** Возвращает объект игры */
		this.getGame = function () {
			return Game;
		};

		/**
		 * Updates game data
		 *
		 * Обновляет данные игры
		 */
		this.refreshGame = function () {
			new Game.NextDayUpdatedManager()[getProtoFn(Game.NextDayUpdatedManager, 6)]();
			try {
				cheats.refreshInventory();
			} catch (e) {}
		};

		/**
		 * Update inventory
		 *
		 * Обновляет инвентарь
		 */
		this.refreshInventory = async function () {
			const GM_INST = getFnP(Game.GameModel, 'get_instance');
			const GM_0 = getProtoFn(Game.GameModel, 0);
			const P_24 = getProtoFn(selfGame['game.model.user.Player'], 24);
			const Player = Game.GameModel[GM_INST]()[GM_0];
			Player[P_24] = new selfGame['game.model.user.inventory.PlayerInventory']();
			Player[P_24].init(await Send({ calls: [{ name: 'inventoryGet', args: {}, ident: 'body' }] }).then((e) => e.results[0].result.response));
		};
		this.updateInventory = function (reward) {
			const GM_INST = getFnP(Game.GameModel, 'get_instance');
			const GM_0 = getProtoFn(Game.GameModel, 0);
			const P_24 = getProtoFn(selfGame['game.model.user.Player'], 24);
			const Player = Game.GameModel[GM_INST]()[GM_0];
			Player[P_24].init(reward);
		};

		this.updateMap = function (data) {
			const PCDD_21 = getProtoFn(selfGame['game.mechanics.clanDomination.model.PlayerClanDominationData'], 21);
			const P_60 = getProtoFn(selfGame['game.model.user.Player'], 60);
			const GM_0 = getProtoFn(Game.GameModel, 0);
			const getInstance = getFnP(selfGame['Game'], 'get_instance');
			const PlayerClanDominationData = Game.GameModel[getInstance]()[GM_0];
			PlayerClanDominationData[P_60][PCDD_21].update(data);
		};

		/**
		 * Change the play screen on windowName
		 *
		 * Сменить экран игры на windowName
		 *
		 * Possible options:
		 *
		 * Возможные варианты:
		 *
		 * MISSION, ARENA, GRAND, CHEST, SKILLS, SOCIAL_GIFT, CLAN, ENCHANT, TOWER, RATING, CHALLENGE, BOSS, CHAT, CLAN_DUNGEON, CLAN_CHEST, TITAN_GIFT, CLAN_RAID, ASGARD, HERO_ASCENSION, ROLE_ASCENSION, ASCENSION_CHEST, TITAN_MISSION, TITAN_ARENA, TITAN_ARTIFACT, TITAN_ARTIFACT_CHEST, TITAN_VALLEY, TITAN_SPIRITS, TITAN_ARTIFACT_MERCHANT, TITAN_ARENA_HALL_OF_FAME, CLAN_PVP, CLAN_PVP_MERCHANT, CLAN_GLOBAL_PVP, CLAN_GLOBAL_PVP_TITAN, ARTIFACT, ZEPPELIN, ARTIFACT_CHEST, ARTIFACT_MERCHANT, EXPEDITIONS, SUBSCRIPTION, NY2018_GIFTS, NY2018_TREE, NY2018_WELCOME, ADVENTURE, ADVENTURESOLO, SANCTUARY, PET_MERCHANT, PET_LIST, PET_SUMMON, BOSS_RATING_EVENT, BRAWL
		 */
		this.goNavigtor = function (windowName) {
			let mechanicStorage = selfGame['game.data.storage.mechanic.MechanicStorage'];
			let window = mechanicStorage[windowName];
			let event = new selfGame['game.mediator.gui.popup.PopupStashEventParams']();
			let Game = selfGame['Game'];
			let navigator = getF(Game, 'get_navigator');
			let navigate = getProtoFn(selfGame['game.screen.navigator.GameNavigator'], 20);
			let instance = getFnP(Game, 'get_instance');
			Game[instance]()[navigator]()[navigate](window, event);
		};

		/**
		 * Move to the sanctuary cheats.goSanctuary()
		 *
		 * Переместиться в святилище cheats.goSanctuary()
		 */
		this.goSanctuary = () => {
			this.goNavigtor('SANCTUARY');
		};

		/** Перейти в Долину титанов */
		this.goTitanValley = () => {
			this.goNavigtor('TITAN_VALLEY');
		};

		/**
		 * Go to Guild War
		 *
		 * Перейти к Войне Гильдий
		 */
		this.goClanWar = function () {
			let instance = getFnP(Game.GameModel, 'get_instance');
			let player = Game.GameModel[instance]().A;
			let clanWarSelect = selfGame['game.mechanics.cross_clan_war.popup.selectMode.CrossClanWarSelectModeMediator'];
			new clanWarSelect(player).open();
		};

		/** Перейти к Острову гильдии */
		this.goClanIsland = function () {
			let instance = getFnP(Game.GameModel, 'get_instance');
			let player = Game.GameModel[instance]().A;
			let clanIslandSelect = selfGame['game.view.gui.ClanIslandPopupMediator'];
			new clanIslandSelect(player).open();
		};

		/**
		 * Go to BrawlShop
		 *
		 * Переместиться в BrawlShop
		 */
		this.goBrawlShop = () => {
			const instance = getFnP(Game.GameModel, 'get_instance');
			const P_36 = getProtoFn(selfGame['game.model.user.Player'], 36);
			const PSD_0 = getProtoFn(selfGame['game.model.user.shop.PlayerShopData'], 0);
			const IM_0 = getProtoFn(selfGame['haxe.ds.IntMap'], 0);
			const PSDE_4 = getProtoFn(selfGame['game.model.user.shop.PlayerShopDataEntry'], 4);

			const player = Game.GameModel[instance]().A;
			const shop = player[P_36][PSD_0][IM_0][1038][PSDE_4];
			const shopPopup = new selfGame['game.mechanics.brawl.mediator.BrawlShopPopupMediator'](player, shop);
			shopPopup.open(new selfGame['game.mediator.gui.popup.PopupStashEventParams']());
		};

		/**
		 * Returns all stores from game data
		 *
		 * Возвращает все магазины из данных игры
		 */
		this.getShops = () => {
			const instance = getFnP(Game.GameModel, 'get_instance');
			const P_36 = getProtoFn(selfGame['game.model.user.Player'], 36);
			const PSD_0 = getProtoFn(selfGame['game.model.user.shop.PlayerShopData'], 0);
			const IM_0 = getProtoFn(selfGame['haxe.ds.IntMap'], 0);

			const player = Game.GameModel[instance]().A;
			return player[P_36][PSD_0][IM_0];
		};

		/**
		 * Returns the store from the game data by ID
		 *
		 * Возвращает магазин из данных игры по идетификатору
		 */
		this.getShop = (id) => {
			const PSDE_4 = getProtoFn(selfGame['game.model.user.shop.PlayerShopDataEntry'], 4);
			const shops = this.getShops();
			const shop = shops[id]?.[PSDE_4];
			return shop;
		};

		/**
		 * Change island map
		 *
		 * Сменить карту острова
		 */
		this.changeIslandMap = (mapId = 2) => {
			const GameInst = getFnP(selfGame['Game'], 'get_instance');
			const GM_0 = getProtoFn(Game.GameModel, 0);
			const PSAD_29 = getProtoFn(selfGame['game.mechanics.season_adventure.model.PlayerSeasonAdventureData'], 29);
			const Player = Game.GameModel[GameInst]()[GM_0];
			const PlayerSeasonAdventureData = findInstanceOf(Player, selfGame['game.mechanics.season_adventure.model.PlayerSeasonAdventureData']);
			PlayerSeasonAdventureData[PSAD_29]({ id: mapId, seasonAdventure: { id: mapId, startDate: 1701914400, endDate: 1709690400, closed: false } });

			const GN_15 = getProtoFn(selfGame['game.screen.navigator.GameNavigator'], 17);
			const navigator = getF(selfGame['Game'], 'get_navigator');
			selfGame['Game'][GameInst]()[navigator]()[GN_15](new selfGame['game.mediator.gui.popup.PopupStashEventParams']());
		};

		/**
		 * Game library availability tracker
		 *
		 * Отслеживание доступности игровой библиотеки
		 */
		function checkLibLoad() {
			timeout = setTimeout(() => {
				if (Game.GameModel) {
					changeLib();
				} else {
					checkLibLoad();
				}
			}, 100);
		}

		/**
		 * Game library data spoofing
		 *
		 * Подмена данных игровой библиотеки
		 */
		function changeLib() {
			console.log('lib connect');
			const originalStartFunc = Game.GameModel.prototype.start;
			Game.GameModel.prototype.start = function (a, b, c) {
				self.libGame = b.raw;
				self.doneLibLoad(self.libGame);
				try {
					const levels = b.raw.seasonAdventure.level;
					for (const id in levels) {
						const level = levels[id];
						level.clientData.graphics.fogged = level.clientData.graphics.visible;
					}
					const adv = b.raw.seasonAdventure.list[1];
					adv.clientData.asset = 'dialog_season_adventure_tiles';
				} catch (e) {
					console.warn(e);
				}
				originalStartFunc.call(this, a, b, c);
			};
		}

		this.LibLoad = function () {
			return new Promise((e) => {
				this.doneLibLoad = e;
			});
		};

		/**
		 * Returns the value of a language constant
		 *
		 * Возвращает значение языковой константы
		 * @param {*} langConst language constant // языковая константа
		 * @returns
		 */
		this.translate = function (langConst) {
			return Game.Translate.translate(langConst);
		};

		connectGame();
		checkLibLoad();
	}

	/**
	 * Auto collection of gifts
	 *
	 * Автосбор подарков
	 */
	function getAutoGifts() {
		// c3ltYm9scyB0aGF0IG1lYW4gbm90aGluZw==
		let valName = 'giftSendIds_' + userInfo.id;

		if (!localStorage['clearGift' + userInfo.id]) {
			localStorage[valName] = '';
			localStorage['clearGift' + userInfo.id] = '+';
		}

		if (!localStorage[valName]) {
			localStorage[valName] = '';
		}

		const giftsAPI = new ZingerYWebsiteAPI('getGifts.php', arguments);
		/**
		 * Submit a request to receive gift codes
		 *
		 * Отправка запроса для получения кодов подарков
		 */
		giftsAPI.request().then((data) => {
			let freebieCheckCalls = {
				calls: [],
			};
			data.forEach((giftId, n) => {
				if (localStorage[valName].includes(giftId)) return;
				freebieCheckCalls.calls.push({
					name: 'registration',
					args: {
						user: { referrer: {} },
						giftId,
					},
					context: {
						actionTs: Math.floor(performance.now()),
						cookie: window?.NXAppInfo?.session_id || null,
					},
					ident: giftId,
				});
			});

			if (!freebieCheckCalls.calls.length) {
				return;
			}

			send(JSON.stringify(freebieCheckCalls), (e) => {
				let countGetGifts = 0;
				const gifts = [];
				for (check of e.results) {
					gifts.push(check.ident);
					if (check.result.response != null) {
						countGetGifts++;
					}
				}
				const saveGifts = localStorage[valName].split(';');
				localStorage[valName] = [...saveGifts, ...gifts].slice(-50).join(';');
				console.log(`${I18N('GIFTS')}: ${countGetGifts}`);
			});
		});
	}

	/**
	 * To fill the kills in the Forge of Souls
	 *
	 * Набить килов в горниле душ
	 */
	async function bossRatingEvent() {
		const topGet = await Send(JSON.stringify({ calls: [{ name: "topGet", args: { type: "bossRatingTop", extraId: 0 }, ident: "body" }] }));
		if (!topGet || !topGet.results[0].result.response[0]) {
			setProgress(`${I18N('EVENT')} ${I18N('NOT_AVAILABLE')}`, true);
			return;
		}
		const replayId = topGet.results[0].result.response[0].userData.replayId;
		const result = await Send(JSON.stringify({
			calls: [
				{ name: "battleGetReplay", args: { id: replayId }, ident: "battleGetReplay" },
				{ name: "heroGetAll", args: {}, ident: "heroGetAll" },
				{ name: "pet_getAll", args: {}, ident: "pet_getAll" },
				{ name: "offerGetAll", args: {}, ident: "offerGetAll" }
			]
		}));
		const bossEventInfo = result.results[3].result.response.find(e => e.offerType == "bossEvent");
		if (!bossEventInfo) {
			setProgress(`${I18N('EVENT')} ${I18N('NOT_AVAILABLE')}`, true);
			return;
		}
		const usedHeroes = bossEventInfo.progress.usedHeroes;
		const party = Object.values(result.results[0].result.response.replay.attackers);
		const availableHeroes = Object.values(result.results[1].result.response).map(e => e.id);
		const availablePets = Object.values(result.results[2].result.response).map(e => e.id);
		const calls = [];
		/**
		 * First pack
		 *
		 * Первая пачка
		 */
		const args = {
			heroes: [],
			favor: {}
		}
		for (let hero of party) {
			if (hero.id >= 6000 && availablePets.includes(hero.id)) {
				args.pet = hero.id;
				continue;
			}
			if (!availableHeroes.includes(hero.id) || usedHeroes.includes(hero.id)) {
				continue;
			}
			args.heroes.push(hero.id);
			if (hero.favorPetId) {
				args.favor[hero.id] = hero.favorPetId;
			}
		}
		if (args.heroes.length) {
			calls.push({
				name: 'bossRating_startBattle',
				args,
				ident: 'body_0',
			});
		}
		/**
		 * Other packs
		 *
		 * Другие пачки
		 */
		let heroes = [];
		let count = 1;
		while (heroId = availableHeroes.pop()) {
			if (args.heroes.includes(heroId) || usedHeroes.includes(heroId)) {
				continue;
			}
			heroes.push(heroId);
			if (heroes.length == 5) {
				calls.push({
					name: 'bossRating_startBattle',
					args: {
						heroes: [...heroes],
						pet: availablePets[Math.floor(Math.random() * availablePets.length)],
					},
					ident: 'body_' + count,
				});
				heroes = [];
				count++;
			}
		}

		if (!calls.length) {
			setProgress(`${I18N('NO_HEROES')}`, true);
			return;
		}

		const resultBattles = await Send(JSON.stringify({ calls }));
		console.log(resultBattles);
		rewardBossRatingEvent();
	}

	/**
	 * Collecting Rewards from the Forge of Souls
	 *
	 * Сбор награды из Горнила Душ
	 */
	function rewardBossRatingEvent() {
		let rewardBossRatingCall = '{"calls":[{"name":"offerGetAll","args":{},"ident":"offerGetAll"}]}';
		send(rewardBossRatingCall, function (data) {
			let bossEventInfo = data.results[0].result.response.find(e => e.offerType == "bossEvent");
			if (!bossEventInfo) {
				setProgress(`${I18N('EVENT')} ${I18N('NOT_AVAILABLE')}`, true);
				return;
			}

			let farmedChests = bossEventInfo.progress.farmedChests;
			let score = bossEventInfo.progress.score;
			setProgress(`${I18N('DAMAGE_AMOUNT')}: ${score}`);
			let revard = bossEventInfo.reward;

			let getRewardCall = {
				calls: []
			}

			let count = 0;
			for (let i = 1; i < 10; i++) {
				if (farmedChests.includes(i)) {
					continue;
				}
				if (score < revard[i].score) {
					break;
				}
				getRewardCall.calls.push({
					name: 'bossRating_getReward',
					args: {
						rewardId: i,
					},
					ident: 'body_' + i,
				});
				count++;
			}
			if (!count) {
				setProgress(`${I18N('NOTHING_TO_COLLECT')}`, true);
				return;
			}

			send(JSON.stringify(getRewardCall), e => {
				console.log(e);
				setProgress(`${I18N('COLLECTED')} ${e?.results?.length} ${I18N('REWARD')}`, true);
			});
		});
	}

	/**
	 * Collect Easter eggs and event rewards
	 *
	 * Собрать пасхалки и награды событий
	 */
	function offerFarmAllReward() {
		const offerGetAllCall = '{"calls":[{"name":"offerGetAll","args":{},"ident":"offerGetAll"}]}';
		return Send(offerGetAllCall).then((data) => {
			const offerGetAll = data.results[0].result.response.filter(e => e.type == "reward" && !e?.freeRewardObtained && e.reward);
			if (!offerGetAll.length) {
				setProgress(`${I18N('NOTHING_TO_COLLECT')}`, true);
				return;
			}

			const calls = [];
			for (let reward of offerGetAll) {
				calls.push({
					name: "offerFarmReward",
					args: {
						offerId: reward.id
					},
					ident: "offerFarmReward_" + reward.id
				});
			}

			return Send(JSON.stringify({ calls })).then(e => {
				console.log(e);
				setProgress(`${I18N('COLLECTED')} ${e?.results?.length} ${I18N('REWARD')}`, true);
			});
		});
	}

	/**
	 * Assemble Outland
	 *
	 * Собрать запределье
	 */
	function getOutland() {
		return new Promise(function (resolve, reject) {
			send('{"calls":[{"name":"bossGetAll","args":{},"ident":"bossGetAll"}]}', e => {
				let bosses = e.results[0].result.response;

				let bossRaidOpenChestCall = {
					calls: []
				};

				for (let boss of bosses) {
					if (boss.mayRaid) {
						bossRaidOpenChestCall.calls.push({
							name: "bossRaid",
							args: {
								bossId: boss.id
							},
							ident: "bossRaid_" + boss.id
						});
						bossRaidOpenChestCall.calls.push({
							name: "bossOpenChest",
							args: {
								bossId: boss.id,
								amount: 1,
								starmoney: 0
							},
							ident: "bossOpenChest_" + boss.id
						});
					} else if (boss.chestId == 1) {
						bossRaidOpenChestCall.calls.push({
							name: "bossOpenChest",
							args: {
								bossId: boss.id,
								amount: 1,
								starmoney: 0
							},
							ident: "bossOpenChest_" + boss.id
						});
					}
				}

				if (!bossRaidOpenChestCall.calls.length) {
					setProgress(`${I18N('OUTLAND')} ${I18N('NOTHING_TO_COLLECT')}`, true);
					resolve();
					return;
				}

				send(JSON.stringify(bossRaidOpenChestCall), e => {
					setProgress(`${I18N('OUTLAND')} ${I18N('COLLECTED')}`, true);
					resolve();
				});
			});
		});
	}

	/**
	 * Collect all rewards
	 *
	 * Собрать все награды
	 */
	function questAllFarm() {
		return new Promise(function (resolve, reject) {
			let questGetAllCall = {
				calls: [{
					name: "questGetAll",
					args: {},
					ident: "body"
				}]
			}
			send(JSON.stringify(questGetAllCall), function (data) {
				let questGetAll = data.results[0].result.response;
				const questAllFarmCall = {
					calls: []
				}
				let number = 0;
				for (let quest of questGetAll) {
					if (quest.id < 1e6 && quest.state == 2) {
						questAllFarmCall.calls.push({
							name: "questFarm",
							args: {
								questId: quest.id
							},
							ident: `group_${number}_body`
						});
						number++;
					}
				}

				if (!questAllFarmCall.calls.length) {
					setProgress(`${I18N('COLLECTED')} ${number} ${I18N('REWARD')}`, true);
					resolve();
					return;
				}

				send(JSON.stringify(questAllFarmCall), function (res) {
					console.log(res);
					setProgress(`${I18N('COLLECTED')} ${number} ${I18N('REWARD')}`, true);
					resolve();
				});
			});
		})
	}

	/**
	 * Mission auto repeat
	 *
	 * Автоповтор миссии
	 * isStopSendMission = false;
	 * isSendsMission = true;
	 **/
	this.sendsMission = async function (param) {
		async function stopMission() {
			isSendsMission = false;
			console.log(I18N('STOPPED'));
			setProgress('');
			await popup.confirm(`${I18N('STOPPED')}<br>${I18N('REPETITIONS')}: ${param.count}`, [{
				msg: 'Ok',
				result: true
			}, ])
		}
		if (isStopSendMission) {
			stopMission();
			return;
		}
		lastMissionBattleStart = Date.now();
		let missionStartCall = {
			"calls": [{
				"name": "missionStart",
				"args": lastMissionStart,
				"ident": "body"
			}]
		}
		/**
		 * Mission Request
		 *
		 * Запрос на выполнение мисии
		 */
		SendRequest(JSON.stringify(missionStartCall), async e => {
			if (e['error']) {
				isSendsMission = false;
				console.log(e['error']);
				setProgress('');
				let msg = e['error'].name + ' ' + e['error'].description + `<br>${I18N('REPETITIONS')}: ${param.count}`;
				await popup.confirm(msg, [
					{msg: 'Ok', result: true},
				])
				return;
			}
			/**
			 * Mission data calculation
			 *
			 * Расчет данных мисии
			 */
			BattleCalc(e.results[0].result.response, 'get_tower', async r => {
				/** missionTimer */
				let timer = getTimer(r.battleTime) + 5;
				const period = Math.ceil((Date.now() - lastMissionBattleStart) / 1000);
				if (period < timer) {
					timer = timer - period;
					const isSuccess = await countdownTimer(timer, `${I18N('MISSIONS_PASSED')}: ${param.count}`, () => {
						isStopSendMission = true;
					});
					if (!isSuccess) {
						stopMission();
						return;
					}
				}

				let missionEndCall = {
					"calls": [{
						"name": "missionEnd",
						"args": {
							"id": param.id,
							"result": r.result,
							"progress": r.progress
						},
						"ident": "body"
					}]
				}
				/**
				 * Mission Completion Request
				 *
				 * Запрос на завершение миссии
				 */
				SendRequest(JSON.stringify(missionEndCall), async (e) => {
					if (e['error']) {
						isSendsMission = false;
						console.log(e['error']);
						setProgress('');
						let msg = e['error'].name + ' ' + e['error'].description + `<br>${I18N('REPETITIONS')}: ${param.count}`;
						await popup.confirm(msg, [
							{msg: 'Ok', result: true},
						])
						return;
					}
					r = e.results[0].result.response;
					if (r['error']) {
						isSendsMission = false;
						console.log(r['error']);
						setProgress('');
						await popup.confirm(`<br>${I18N('REPETITIONS')}: ${param.count}` + ' 3 ' + r['error'], [
							{msg: 'Ok', result: true},
						])
						return;
					}

					param.count++;
					setProgress(`${I18N('MISSIONS_PASSED')}: ${param.count} (${I18N('STOP')})`, false, () => {
						isStopSendMission = true;
					});
					setTimeout(sendsMission, 1, param);
				});
			})
		});
	}

	/**
	 * Opening of russian dolls
	 *
	 * Открытие матрешек
	 */
	async function openRussianDolls(libId, amount) {
		let sum = 0;
		const sumResult = {};
		let count = 0;

		while (amount) {
			sum += amount;
			setProgress(`${I18N('TOTAL_OPEN')} ${sum}`);
			const calls = [
				{
					name: 'consumableUseLootBox',
					args: { libId, amount },
					ident: 'body',
				},
			];
			const response = await Send(JSON.stringify({ calls })).then((e) => e.results[0].result.response);
			let [countLootBox, result] = Object.entries(response).pop();
			count += +countLootBox;
			let newCount = 0;

			if (result?.consumable && result.consumable[libId]) {
				newCount = result.consumable[libId];
				delete result.consumable[libId];
			}

			mergeItemsObj(sumResult, result);
			amount = newCount;
		}

		setProgress(`${I18N('TOTAL_OPEN')} ${sum}`, 5000);
		return [count, sumResult];
	}

	function mergeItemsObj(obj1, obj2) {
		for (const key in obj2) {
			if (obj1[key]) {
				if (typeof obj1[key] == 'object') {
					for (const innerKey in obj2[key]) {
						obj1[key][innerKey] = (obj1[key][innerKey] || 0) + obj2[key][innerKey];
					}
				} else {
					obj1[key] += obj2[key] || 0;
				}
			} else {
				obj1[key] = obj2[key];
			}
		}

		return obj1;
	}

	/**
	 * Collect all mail, except letters with energy and charges of the portal
	 *
	 * Собрать всю почту, кроме писем с энергией и зарядами портала
	 */
	function mailGetAll() {
		const getMailInfo = '{"calls":[{"name":"mailGetAll","args":{},"ident":"body"}]}';

		return Send(getMailInfo).then(dataMail => {
			const { Letters } = HWHClasses;
			const letters = dataMail.results[0].result.response.letters;
			const letterIds = Letters.filter(letters);
			if (!letterIds.length) {
				setProgress(I18N('NOTHING_TO_COLLECT'), true);
				return;
			}

			const calls = [
				{ name: "mailFarm", args: { letterIds }, ident: "body" }
			];

			return Send(JSON.stringify({ calls })).then(res => {
				const lettersIds = res.results[0].result.response;
				if (lettersIds) {
					const countLetters = Object.keys(lettersIds).length;
					setProgress(`${I18N('RECEIVED')} ${countLetters} ${I18N('LETTERS')}`, true);
				}
			});
		});
	}

	class Letters {
		/**
		 * Максимальное оставшееся время для автоматического сбора письма (24 часа)
		 */
		static MAX_TIME_LEFT = 24 * 60 * 60 * 1000;

		/**
		 * Фильтрует получаемые письма
		 * @param {Array} letters - Массив писем для фильтрации
		 * @returns {Array} - Массив ID писем, которые нужно собрать
		 */
		static filter(letters) {
			const { Letters } = HWHClasses;
			const lettersIds = [];

			for (let l in letters) {
				const letter = letters[l];
				const reward = letter?.reward;

				if (!reward || !Object.keys(reward).length) {
					continue;
				}

				if (Letters.shouldCollectLetter(reward)) {
					lettersIds.push(~~letter.id);
					continue;
				}

				// Проверка времени до окончания годности письма
				const availableUntil = +letter?.availableUntil;
				if (availableUntil) {
					const timeLeft = new Date(availableUntil * 1000) - new Date();
					console.log('Time left:', timeLeft);

					if (timeLeft < Letters.MAX_TIME_LEFT) {
						lettersIds.push(~~letter.id);
					}
				}
			}

			return lettersIds;
		}

		/**
		 * Определяет, нужно ли собирать письмо (может быть переопределен в дочерних классах)
		 * @param {Object} reward - Награда письма
		 * @returns {boolean} - Нужно ли собирать письмо
		 */
		static shouldCollectLetter(reward) {
			return !(
				/** Portals // сферы портала */
				(
					(reward?.refillable ? reward.refillable[45] : false) ||
					/** Energy // энергия */
					(reward?.stamina ? reward.stamina : false) ||
					/** accelerating energy gain // ускорение набора энергии */
					(reward?.buff ? true : false) ||
					/** VIP Points // вип очки */
					(reward?.vipPoints ? reward.vipPoints : false) ||
					/** souls of heroes // душы героев */
					(reward?.fragmentHero ? true : false) ||
					/** heroes // герои */
					(reward?.bundleHeroReward ? true : false)
				)
			);
		}
	}

	this.HWHClasses.Letters = Letters;

	function setPortals(value = 0, isChange = false) {
		const { buttons } = HWHData;
		const sanctuaryButton = buttons['testAdventure'].button;
		const sanctuaryDot = sanctuaryButton.querySelector('.scriptMenu_dot');
		if (isChange) {
			value = Math.max(+sanctuaryDot.innerText + value, 0);
		}
		if (value) {
			sanctuaryButton.classList.add('scriptMenu_attention');
			sanctuaryDot.title = `${value} ${I18N('PORTALS')}`;
			sanctuaryDot.innerText = value;
			sanctuaryDot.style.backgroundColor = 'red';
		} else {
			sanctuaryButton.classList.remove('scriptMenu_attention');
			sanctuaryDot.innerText = 0;
		}
	}

	function setWarTries(value = 0, isChange = false, arePointsMax = false) {
		const { buttons } = HWHData;
		const clanWarButton = buttons['goToClanWar'].button;
		const clanWarDot = clanWarButton.querySelector('.scriptMenu_dot');
		if (isChange) {
			value = Math.max(+clanWarDot.innerText + value, 0);
		}
		if (value && !arePointsMax) {
			clanWarButton.classList.add('scriptMenu_attention');
			clanWarDot.title = `${value} ${I18N('ATTEMPTS')}`;
			clanWarDot.innerText = value;
			clanWarDot.style.backgroundColor = 'red';
		} else {
			clanWarButton.classList.remove('scriptMenu_attention');
			clanWarDot.innerText = 0;
		}
	}

	/**
	 * Displaying information about the areas of the portal and attempts on the VG
	 *
	 * Отображение информации о сферах портала и попытках на ВГ
	 */
	async function justInfo() {
		return new Promise(async (resolve, reject) => {
			const calls = [
				{
					name: 'userGetInfo',
					args: {},
					ident: 'userGetInfo',
				},
				{
					name: 'clanWarGetInfo',
					args: {},
					ident: 'clanWarGetInfo',
				},
				{
					name: 'titanArenaGetStatus',
					args: {},
					ident: 'titanArenaGetStatus',
				},
				{
					name: 'quest_completeEasterEggQuest',
					args: {},
					ident: 'quest_completeEasterEggQuest',
				},
			];
			const result = await Send(JSON.stringify({ calls }));
			const infos = result.results;
			const portalSphere = infos[0].result.response.refillable.find(n => n.id == 45);
			const clanWarMyTries = infos[1].result.response?.myTries ?? 0;
			const arePointsMax = infos[1].result.response?.arePointsMax;
			const titansLevel = +(infos[2].result.response?.tier ?? 0);
			const titansStatus = infos[2].result.response?.status; //peace_time || battle

			setPortals(portalSphere.amount);
			setWarTries(clanWarMyTries, false, arePointsMax);

			const { buttons } = HWHData;
			const titansArenaButton = buttons['testTitanArena'].button;
			const titansArenaDot = titansArenaButton.querySelector('.scriptMenu_dot');

			if (titansLevel < 7 && titansStatus == 'battle') { ;
				titansArenaButton.classList.add('scriptMenu_attention');
				titansArenaDot.title = `${titansLevel} ${I18N('LEVEL')}`;
				titansArenaDot.innerText = titansLevel;
				titansArenaDot.style.backgroundColor = 'red';
			} else {
				titansArenaButton.classList.remove('scriptMenu_attention');
			}

			const imgPortal =
				'data:image/gif;base64,R0lGODlhLwAvAHAAACH5BAEAAP8ALAAAAAAvAC8AhwAAABkQWgjF3krO3ghSjAhSzinF3u+tGWvO3s5rGSmE5gha7+/OWghSrWvmnClShCmUlAiE5u+MGe/W3mvvWmspUmvvGSnOWinOnCnOGWsZjErvnAiUlErvWmsIUkrvGQjOWgjOnAjOGUoZjM6MGe/OIWvv5q1KGSnv5mulGe/vWs7v3ozv3kqEGYxKGWuEWmtSKUrv3mNaCEpKUs7OWiml5ggxWmMpEAgZpRlaCO/35q1rGRkxKWtarSkZrRljKSkZhAjv3msIGRk6CEparQhjWq3v3kql3ozOGe/vnM6tGYytWu9rGWuEGYzO3kqE3gil5s6MWq3vnGvFnM7vWoxrGc5KGYyMWs6tWq2MGYzOnO+tWmvFWkqlWoxrWgAZhEqEWq2tWoytnIyt3krFnGul3mulWmulnEIpUkqlGUqlnK3OnK2MWs7OnClSrSmUte+tnGvFGYytGYzvWs5rWowpGa3O3u/OnErFWoyMnGuE3muEnEqEnIyMGYzOWs7OGe9r3u9rWq3vWq1rWq1r3invWimlWu+t3q0pWq2t3u8pWu8p3q0p3invnCnvGe/vGa2tGa3vGa2tnK0pGe9rnK1rnCmlGe8pGe8pnK0pnGsZrSkp3msp3s7vGYzvnM7vnIzvGc6tnM5r3oxr3gilWs6t3owpWs4pWs4p3owp3s5rnIxrnAilGc4pGc4pnIwpnAgp3kop3s7O3u9KGe+MWoxKWoyM3kIIUgiUte+MnErFGc5KWowIGe9K3u9KWq3OWq1KWq1K3gjvWimEWu+M3q0IWq2M3u8IWu8I3q0I3gjvnAjvGa3OGa2MnK0IGe9KnK1KnCmEGe8IGe8InK0InEoZrSkI3msI3s6MnM5K3oxK3giEWs6M3owIWs4IWs4I3owI3s5KnIxKnAiEGc4IGc4InIwInAgI3koI3kJaCAgQKUIpEGtKUkJSKUIIECla7ylazmtahGta70pa70pahGtazkpazmtrWiExUkprUiljWikQKRkQCAAQCAAACAAAAAj/AP8JHEiwoMGDCBMqXMiwocODJlBIRBHDxMOLBmMEkSjAgICPE2Mw/OUH4z8TGz+agBIBCsuWUAQE0WLwzkAkKZZcnAilhk+fA1bUiEC0ZZABJOD8IyHhwJYDkpakafJQ4kooR5yw0LFihQ4WJhAMKCoARRYSTJgkUOInBZK2DiX2rGHEiI67eFcYATtAAVEoKEiQSFBFDs4UKbg0lGgAigIEeCNzrWvCxIChEcoy3dGiSoITTRQvnCLRrxOveI2McbKahevKJmooiKkFy4Gzg5tMMaMwitwIj/PqGPCugL0CT47ANhEjQg3Atg9IT5CiS4uEUcRIBH4EtREETuB9/xn/BUcBBbBXGGgpoPaBEid23EuXgvdBJhtQGFCwwA7eMgs0gEMDBJD3hR7KbRVbSwP8UcIWJNwjIRLXGZRAAhLVsIACR9y1whMNfNGAHgiUcUSBX8ADWwwKzCYADTSUcMA9ebwQmkFYMMFGhgu80x1XTxSAwxNdGWGCAiG6YQBzly3QkhYxlsDGP1cg4YBBaC0h1zsLPGHXCkfA00AZeu11hALl1VBZXwW0RAaMDGDxTxNdTGEQExJoiUINXCpwmhFOKJCcVmCdOR56MezXJhRvwFlCC2lcWVAUEjBxRobw9HhEXUYekWBlsoVoQEWyFbAAFPRIQQMDJcDQhRhYSv+QZ1kGcAnPYya4BhZYlb1TQ4iI+tVmBPpIQQWrMORxkKwSsEFrDaa+8xgCy1mmgLSHxtDXAhtGMIOxDKjgAkLM7iAAYD4VJ+0RAyAgVl++ikfAESxy62QB365awrjLyprAcxEY4FOmXEp7LbctjlfAAE1yGwEBYBirAgP8GtTUARIMM1QBPrVYQAHF9dgiml/Mexl/3DbAwxnHMqBExQVdLAEMjRXQgHOyydaibPCgqEDH3JrawDosUDExCTATZJuMJ0AAxRNXtLFFPD+P/DB58AC9wH4N4BMxDRPvkPRAbLx3AAlVMLBFCXeQgIaIKJKHQ9X8+forAetMsaoKB7j/MAhCL5j9VFNPJYBGiCGW18CtsvWIs5j7gLEGqyV81gxC6ZBQQgkSMEUCLQckMMLHNhcAD3B+8TdyA0PPACWrB8SH0BItyHAAAwdE4YILTSUww8cELwAyt7D4JSberkd5wA4neIFQE020sMPmJZBwAi0SJMBOA6WTXgAsDYDPOj7r3KNFy5WfkEBCKbTQBQzTM+By5wm4YAPr+LM+IIE27LPOFWswmgqqZ4UEXCEhLUjBGWbgAs3JD2OfWcc68GEDArCOAASwAfnWUYUwtIEKSVCBCiSgPuclpAlImMI9YNDAzeFuMEwQ2w3W4Q530PAGLthBFNqwghCKMAoF3MEB/xNihvr8Ix4sdCCrJja47CVAMFjAwid6eJcQWi8BO4jHQl6AGFjdwwUnOMF75CfCMpoxCTpAoxoZMBgs3qMh7ZODQFYYxgSMsQThCpcK0BiZJNxBCZ7zwhsbYqO3wCoe7AjjCaxAggNUcY94mcDa3qMECWSBHYN0CBfj0IQliEFCMFjkIulAAisUkBZYyB4USxAFCZnkH1xsgltSYCMYyACMpizghS7kOTZIKJMmeYEZzCCH6iCmBS1IRzpkcEsXVMGZMMgHJvfwyoLsYQ9nmMIUuDAFPIAhH8pUZjLbcY89rKKaC9nDFeLxy3vkYwbJTMcL0InOeOSjBVShJz2pqQvPfvrznwANKEMCAgA7';

			setProgress('<img src="' + imgPortal + '" style="height: 25px;position: relative;top: 5px;"> ' + `${portalSphere.amount} </br> ${I18N('GUILD_WAR')}: ${clanWarMyTries}`, true);
			resolve();
		});
	}

	async function getDailyBonus() {
		const dailyBonusInfo = await Send(JSON.stringify({
			calls: [{
				name: "dailyBonusGetInfo",
				args: {},
				ident: "body"
			}]
		})).then(e => e.results[0].result.response);
		const { availableToday, availableVip, currentDay } = dailyBonusInfo;

		if (!availableToday) {
			console.log('Уже собрано');
			return;
		}

		const currentVipPoints = +userInfo.vipPoints;
		const dailyBonusStat = lib.getData('dailyBonusStatic');
		const vipInfo = lib.getData('level').vip;
		let currentVipLevel = 0;
		for (let i in vipInfo) {
			vipLvl = vipInfo[i];
			if (currentVipPoints >= vipLvl.vipPoints) {
				currentVipLevel = vipLvl.level;
			}
		}
		const vipLevelDouble = dailyBonusStat[`${currentDay}_0_0`].vipLevelDouble;

		const calls = [{
			name: "dailyBonusFarm",
			args: {
				vip: availableVip && currentVipLevel >= vipLevelDouble ? 1 : 0
			},
			ident: "body"
		}];

		const result = await Send(JSON.stringify({ calls }));
		if (result.error) {
			console.error(result.error);
			return;
		}

		const reward = result.results[0].result.response;
		const type = Object.keys(reward).pop();
		const itemId = Object.keys(reward[type]).pop();
		const count = reward[type][itemId];
		const itemName = cheats.translate(`LIB_${type.toUpperCase()}_NAME_${itemId}`);

		console.log(`Ежедневная награда: Получено ${count} ${itemName}`, reward);
	}

	async function farmStamina(lootBoxId = 148) {
		const lootBox = await Send('{"calls":[{"name":"inventoryGet","args":{},"ident":"inventoryGet"}]}')
			.then(e => e.results[0].result.response.consumable[148]);

		/** Добавить другие ящики */
		/**
		 * 144 - медная шкатулка
		 * 145 - бронзовая шкатулка
		 * 148 - платиновая шкатулка
		 */
		if (!lootBox) {
			setProgress(I18N('NO_BOXES'), true);
			return;
		}

		let maxFarmEnergy = getSaveVal('maxFarmEnergy', 100);
		const result = await popup.confirm(I18N('OPEN_LOOTBOX', { lootBox }), [
			{ result: false, isClose: true },
			{ msg: I18N('BTN_YES'), result: true },
			{ msg: I18N('STAMINA'), isInput: true, default: maxFarmEnergy },
		]);

		if (!+result) {
			return;
		}

		if ((typeof result) !== 'boolean' && Number.parseInt(result)) {
			maxFarmEnergy = +result;
			setSaveVal('maxFarmEnergy', maxFarmEnergy);
		} else {
			maxFarmEnergy = 0;
		}

		let collectEnergy = 0;
		for (let count = lootBox; count > 0; count--) {
			const response = await Send('{"calls":[{"name":"consumableUseLootBox","args":{"libId":148,"amount":1},"ident":"body"}]}').then(
				(e) => e.results[0].result.response
			);
			const result = Object.values(response).pop();
			if ('stamina' in result) {
				setProgress(`${I18N('OPEN')}: ${lootBox - count}/${lootBox} ${I18N('STAMINA')} +${result.stamina}<br>${I18N('STAMINA')}: ${collectEnergy}`, false);
				console.log(`${ I18N('STAMINA') } + ${ result.stamina }`);
				if (!maxFarmEnergy) {
					return;
				}
				collectEnergy += +result.stamina;
				if (collectEnergy >= maxFarmEnergy) {
					console.log(`${I18N('STAMINA')} + ${ collectEnergy }`);
					setProgress(`${I18N('STAMINA')} + ${ collectEnergy }`, false);
					return;
				}
			} else {
				setProgress(`${I18N('OPEN')}: ${lootBox - count}/${lootBox}<br>${I18N('STAMINA')}: ${collectEnergy}`, false);
				console.log(result);
			}
		}

		setProgress(I18N('BOXES_OVER'), true);
	}

	async function fillActive() {
		const data = await Send(JSON.stringify({
			calls: [{
				name: "questGetAll",
				args: {},
				ident: "questGetAll"
			}, {
				name: "inventoryGet",
				args: {},
				ident: "inventoryGet"
			}, {
				name: "clanGetInfo",
				args: {},
				ident: "clanGetInfo"
			}
		]
		})).then(e => e.results.map(n => n.result.response));

		const quests = data[0];
		const inv = data[1];
		const stat = data[2].stat;
		const maxActive = 2000 - stat.todayItemsActivity;
		if (maxActive <= 0) {
			setProgress(I18N('NO_MORE_ACTIVITY'), true);
			return;
		}

		let countGetActive = 0;
		const quest = quests.find(e => e.id > 10046 && e.id < 10051);
		if (quest) {
			countGetActive = 1750 - quest.progress;
		}

		if (countGetActive <= 0) {
			countGetActive = maxActive;
		}
		console.log(countGetActive);

		countGetActive = +(await popup.confirm(I18N('EXCHANGE_ITEMS', { maxActive }), [
			{ result: false, isClose: true },
			{ msg: I18N('GET_ACTIVITY'), isInput: true, default: countGetActive.toString() },
		]));

		if (!countGetActive) {
			return;
		}

		if (countGetActive > maxActive) {
			countGetActive = maxActive;
		}

		const items = lib.getData('inventoryItem');

		let itemsInfo = [];
		for (let type of ['gear', 'scroll']) {
			for (let i in inv[type]) {
				const v = items[type][i]?.enchantValue || 0;
				itemsInfo.push({
					id: i,
					count: inv[type][i],
					v,
					type
				})
			}
			const invType = 'fragment' + type.toLowerCase().charAt(0).toUpperCase() + type.slice(1);
			for (let i in inv[invType]) {
				const v = items[type][i]?.fragmentEnchantValue || 0;
				itemsInfo.push({
					id: i,
					count: inv[invType][i],
					v,
					type: invType
				})
			}
		}
		itemsInfo = itemsInfo.filter(e => e.v < 4 && e.count > 200);
		itemsInfo = itemsInfo.sort((a, b) => b.count - a.count);
		console.log(itemsInfo);
		const activeItem = itemsInfo.shift();
		console.log(activeItem);
		const countItem = Math.ceil(countGetActive / activeItem.v);
		if (countItem > activeItem.count) {
			setProgress(I18N('NOT_ENOUGH_ITEMS'), true);
			console.log(activeItem);
			return;
		}

		await Send(JSON.stringify({
			calls: [{
				name: "clanItemsForActivity",
				args: {
					items: {
						[activeItem.type]: {
							[activeItem.id]: countItem
						}
					}
				},
				ident: "body"
			}]
		})).then(e => {
			/** TODO: Вывести потраченые предметы */
			console.log(e);
			setProgress(`${I18N('ACTIVITY_RECEIVED')}: ` + e.results[0].result.response, true);
		});
	}

	async function buyHeroFragments() {
		const result = await Send('{"calls":[{"name":"inventoryGet","args":{},"ident":"inventoryGet"},{"name":"shopGetAll","args":{},"ident":"shopGetAll"}]}')
			.then(e => e.results.map(n => n.result.response));
		const inv = result[0];
		const shops = Object.values(result[1]).filter(shop => [4, 5, 6, 8, 9, 10, 17].includes(shop.id));
		const calls = [];

		for (let shop of shops) {
			const slots = Object.values(shop.slots);
			for (const slot of slots) {
				/* Уже куплено */
				if (slot.bought) {
					continue;
				}
				/* Не душа героя */
				if (!('fragmentHero' in slot.reward)) {
					continue;
				}
				const coin = Object.keys(slot.cost).pop();
				const coinId = Object.keys(slot.cost[coin]).pop();
				const stock = inv[coin][coinId] || 0;
				/* Не хватает на покупку */
				if (slot.cost[coin][coinId] > stock) {
					continue;
				}
				inv[coin][coinId] -= slot.cost[coin][coinId];
				calls.push({
					name: "shopBuy",
					args: {
						shopId: shop.id,
						slot: slot.id,
						cost: slot.cost,
						reward: slot.reward,
					},
					ident: `shopBuy_${shop.id}_${slot.id}`,
				})
			}
		}

		if (!calls.length) {
			setProgress(I18N('NO_PURCHASABLE_HERO_SOULS'), true);
			return;
		}

		const bought = await Send(JSON.stringify({ calls })).then(e => e.results.map(n => n.result.response));
		if (!bought) {
			console.log('что-то пошло не так')
			return;
		}

		let countHeroSouls = 0;
		for (const buy of bought) {
			countHeroSouls += +Object.values(Object.values(buy).pop()).pop();
		}
		console.log(countHeroSouls, bought, calls);
		setProgress(I18N('PURCHASED_HERO_SOULS', { countHeroSouls }), true);
	}

	/** Открыть платные сундуки в Запределье за 90 */
	async function bossOpenChestPay() {
		const callsNames = ['userGetInfo', 'bossGetAll', 'specialOffer_getAll', 'getTime'];
		const info = await Send({ calls: callsNames.map((name) => ({ name, args: {}, ident: name })) }).then((e) =>
			e.results.map((n) => n.result.response)
		);

		const user = info[0];
		const boses = info[1];
		const offers = info[2];
		const time = info[3];

		const discountOffer = offers.find((e) => e.offerType == 'costReplaceOutlandChest');

		let discount = 1;
		if (discountOffer && discountOffer.endTime > time) {
			discount = 1 - discountOffer.offerData.outlandChest.discountPercent / 100;
		}

		cost9chests = 540 * discount;
		cost18chests = 1740 * discount;
		costFirstChest = 90 * discount;
		costSecondChest = 200 * discount;

		const currentStarMoney = user.starMoney;
		if (currentStarMoney < cost9chests) {
			setProgress('Недостаточно изюма, нужно ' + cost9chests + ' у Вас ' + currentStarMoney, true);
			return;
		}

		const imgEmerald =
			"<img style='position: relative;top: 3px;' src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAAXCAYAAAD+4+QTAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAY8SURBVEhLpVV5bFVlFv/d7a19W3tfN1pKabGFAm3Rlg4toAWRiH+AioiaqAkaE42NycRR0ZnomJnJYHAJERGNyx/GJYoboo2igKVSMUUKreW1pRvUvr7XvvXe9+7qeW1nGJaJycwvObnny/fl/L7zO+c7l8EV0LAKzA+H83lAFAC/BeDJN2gnc5yd/WaQ8Q0NCCnAANkU+ZfjIpKqJWBOd4EDbHagueBPb1tWuesi9Rqn86zJZDbAMTp4xoSFzMaa4FVe6fra3bbzQbYN6A8Cmrz0qoBx8gzMmaj/QfKHWyxs+4e1DiC78M9v5TTn1RtbVH+kMWlJCCad100VOmQiUWFnNLg4HW42QeYEl3KnIiP5Bzu/dr27o0UistD48k2d8rF9Sib9GZKaejAnOmrs2/6e3VR3q7idF41GWVA41uQQ1RMY00ZJrChcrAYvx8HHaSjil8LLilCY98BORylBKlWQHhjzfvfFnuTfPn1O+xFolzM7s5nMI80rSl7qib8ykRNcWyaUosBWgnN6BL3pHuRwucjmnBTUCjfHwElkNiaNPHYr0mYCKnMeE/r3OC2NQiZZheHsfQ9Vu1uAM+eBIX2W5Nqsh/ewtxlrhl75NtUviDpwq+s+NOXWwWFhKKCd6iCQVByV2qSb0wEo5PvhY9YikGrH3uAdiBtBDIdVVAvlyfjBOffuesTcDxySqD3mUxaOPLZ6aktAOS/kqHaYigN7gnsxMGnDAuEuiPw6ymIt3MwaZFFQB7MeTmYjPLSWjTTCioQ5XCOMJIPeoInD/SNOviy6heLmALkckRTyf3xLbtQ8k6sdOodcxoocMoXU9JoFdF8VESMMiWRJmykyedqXTInaQJnOTtYDcJtZ+DXkRSrOou1cCoHx4LptL0nLgYU8kWhwlFgrNV2wFnEmVAr+w9gUzkwQic2DoNmLYe0QgkYXIuYg4uYYosYQJs1fMGkEpqWzUVucDh9E37gCIWFgvY9FcbniEipii6hbwZVilP0kXB/jysrrPLqU3yDG0JzXhA3OjWgsXo8UG6XbR6AxScqJjJHo/gmY0+9FIOn80I0UkukQFohJNFZmwV/uhosX2j59KPuF8JgS5CI3wHB90RUdKL12pMs7Z3VvfH6WyOajPt+Deb7FRDCBmNmNpNmPhHEWCW0IMXUQaTVEtVPhseYTZRCBeB86h8+hY0yDodsHfny+4NETB7JOLN74TXqmu1Yu4ixHuj3ii0/eaatx7RgY/NYKtR2tm+6B7lbwTGg3bDQ06MLTcsoJettR4DqaC8+u/gfe6HwZOzuGQU8JDR5f1B2+6uHWp8RPSjfsj5/dDyMzfIAj3bqSK8bGW579ECPWXRViHTijDK2BPojcPCxkbXCZflh1H5ISkCCSWJxI8jcjmErhnaHh6fdzdbZTd0aKd7Q+5T/gqj6VyBBkwmfG0QySkkHDJq19dDrgvP3GQq/Pt6h/8mesLqqFz+6DRq0qWkR4uGzEYhrGJBktNdvQGfoJH490YwmNuwKt+LWvWubtAk6GlPHhfw/LCyQz0BXEZOaoLcDf1lAt2z1z5nIhlIsL0Csfo90sWDkHXDYXaq2VWFZShffOfoQc0qOIzT9wbGvpXxOYGgG6SdwLuJSE6mPT1ZNdUdM9fyi8YlnTEiHLc423GBPaFBSVQcrQqcMYrJrbjElVRUf8FIq57K4z/8x7rL9f7ymsb0vHz83GmsXlJJSlsXKhxn3w+YSyrC48vKB0zVbLYqHCUYEe5SekaRYznBuLvU1olwbBmvr4r/v4RzteN4761x+Wxg9dGPH/wkzhL8WRHkMvKo7j/sc/Swfir7ZT/WTYSapc6LwFhc4qSKwLEYHXoz/bnzv8dOw7+4ojyYkvLyfI4MokhNToSKZwYf+6u3e39P3y8XH6AeY5yxHiBcx11OA8rZO9qTdaNx9/n9KPyUdnOulKuFyui6GHAAkHpEDBptqauaKtcMySRBW3HH2Do1+9WbP9GXocVGj5okJfit8jATY06Dh+MBIyiwZrrylb4XXneO1BV9df7n/tMb0/0J17O9LJU7Nn/x+UrKvOyOq58dXtNz0Q2Luz+cUnrqe1q+qmyv8q9/+EypuXZrK2kdEwgW3R5pW/r8I0gN8AVk6uP7Y929oAAAAASUVORK5CYII='>";

		if (currentStarMoney < cost9chests) {
			setProgress(I18N('NOT_ENOUGH_EMERALDS_540', { currentStarMoney, imgEmerald }), true);
			return;
		}

		const buttons = [{ result: false, isClose: true }];

		if (currentStarMoney >= cost9chests) {
			buttons.push({
				msg: I18N('BUY_OUTLAND_BTN', { count: 9, countEmerald: cost9chests, imgEmerald }),
				result: [costFirstChest, costFirstChest, 0],
			});
		}

		if (currentStarMoney >= cost18chests) {
			buttons.push({
				msg: I18N('BUY_OUTLAND_BTN', { count: 18, countEmerald: cost18chests, imgEmerald }),
				result: [costFirstChest, costFirstChest, 0, costSecondChest, costSecondChest, 0],
			});
		}

		const answer = await popup.confirm(`<div style="margin-bottom: 15px;">${I18N('BUY_OUTLAND')}</div>`, buttons);

		if (!answer) {
			return;
		}

		const callBoss = [];
		let n = 0;
		for (let boss of boses) {
			const bossId = boss.id;
			if (boss.chestNum != 2) {
				continue;
			}
			const calls = [];
			for (const starmoney of answer) {
				calls.push({
					name: 'bossOpenChest',
					args: {
						amount: 1,
						bossId,
						starmoney,
					},
					ident: 'bossOpenChest_' + ++n,
				});
			}
			callBoss.push(calls);
		}

		if (!callBoss.length) {
			setProgress(I18N('CHESTS_NOT_AVAILABLE'), true);
			return;
		}

		let count = 0;
		let errors = 0;
		for (const calls of callBoss) {
			const result = await Send({ calls });
			console.log(result);
			if (result?.results) {
				count += result.results.length;
			} else {
				errors++;
			}
		}

		setProgress(`${I18N('OUTLAND_CHESTS_RECEIVED')}: ${count}`, true);
	}

	async function autoRaidAdventure() {
		const calls = [
			{
				name: "userGetInfo",
				args: {},
				ident: "userGetInfo"
			},
			{
				name: "adventure_raidGetInfo",
				args: {},
				ident: "adventure_raidGetInfo"
			}
		];
		const result = await Send(JSON.stringify({ calls }))
			.then(e => e.results.map(n => n.result.response));

		const portalSphere = result[0].refillable.find(n => n.id == 45);
		const adventureRaid = Object.entries(result[1].raid).filter(e => e[1]).pop()
		const adventureId = adventureRaid ? adventureRaid[0] : 0;

		if (!portalSphere.amount || !adventureId) {
			setProgress(I18N('RAID_NOT_AVAILABLE'), true);
			return;
		}

		const countRaid = +(await popup.confirm(I18N('RAID_ADVENTURE', { adventureId }), [
			{ result: false, isClose: true },
			{ msg: I18N('RAID'), isInput: true, default: portalSphere.amount },
		]));

		if (!countRaid) {
			return;
		}

		if (countRaid > portalSphere.amount) {
			countRaid = portalSphere.amount;
		}

		const resultRaid = await Send(JSON.stringify({
			calls: [...Array(countRaid)].map((e, i) => ({
				name: "adventure_raid",
				args: {
					adventureId
				},
				ident: `body_${i}`
			}))
		})).then(e => e.results.map(n => n.result.response));

		if (!resultRaid.length) {
			console.log(resultRaid);
			setProgress(I18N('SOMETHING_WENT_WRONG'), true);
			return;
		}

		console.log(resultRaid, adventureId, portalSphere.amount);
		setProgress(I18N('ADVENTURE_COMPLETED', { adventureId, times: resultRaid.length }), true);
	}

	/**
	 * Auto raid mission function
	 * Автоматическое выполнение рейд миссий
	 */
	async function autoRaidMission() {
		try {
			console.log('%cAuto Raid Mission: Function started', 'color: green; font-weight: bold;');
			
			// Get user info and mission data
			const calls = [
				{
					name: "userGetInfo",
					args: {},
					ident: "userGetInfo"
				},
				{
					name: "missionGetAll",
					args: {},
					ident: "missionGetAll"
				}
			];

			const result = await Send(JSON.stringify({ calls }))
				.then(e => e.results.map(n => n.result.response));

			console.log('%cAuto Raid Mission: API response received:', 'color: blue;', result);

			const userInfo = result[0];
			const missionsData = result[1];
			
			// Convert missions object to array (missions are stored as object, not array)
			const missions = Object.values(missionsData);
			
			console.log('%cAuto Raid Mission: User info:', 'color: blue;', userInfo);
			console.log('%cAuto Raid Mission: Missions data (raw):', 'color: blue;', missionsData);
			console.log('%cAuto Raid Mission: Missions array:', 'color: blue;', missions);

			// Check if user has energy for raids
			const energy = userInfo.refillable.find(n => n.id == 1);
			
			if (!energy || energy.amount < 10) {
				setProgress(I18N('NOT_ENOUGH_ENERGY'), true);
				return;
			}

			// Find available missions for raiding (campaign missions with 3 stars)
			console.log('%cAuto Raid Mission: Total missions received:', 'color: blue;', missions.length);
			console.log('%cAuto Raid Mission: Energy available:', 'color: blue;', energy.amount);
			
			// Debug: Show first few missions to understand the structure
			if (missions.length > 0) {
				console.log('%cAuto Raid Mission: Sample mission data:', 'color: blue;', missions.slice(0, 3).map(m => ({
					id: m.id,
					stars: m.stars,
					isOpen: m.isOpen,
					canRaid: m.canRaid,
					energy: m.energy,
					name: m.name || 'Unknown'
				})));
			}
			
			// Filter missions that can be raided (3 stars and available)
			const availableMissions = missions.filter(mission => 
				mission.stars === 3 && 
				mission.isOpen
			);

			console.log('%cAuto Raid Mission: Available missions after filtering:', 'color: blue;', availableMissions.length);

			if (availableMissions.length === 0) {
				console.log('%cAuto Raid Mission: No missions qualify for raiding', 'color: red;');
				setProgress(I18N('NO_RAID_MISSIONS_AVAILABLE'), true);
				return;
			}

			// Select the first available mission (simplified approach)
			const selectedMission = availableMissions[0];
			
			// For now, just do 3 raids (same as existing quest system)
			const raidCount = 3;

			setProgress(I18N('STARTING_RAID_MISSIONS', { 
				missionId: selectedMission.id, 
				count: raidCount 
			}), false);

			// Execute raid missions
			const raidCalls = [{
				name: "missionRaid",
				args: {
					id: selectedMission.id,
					times: raidCount
				},
				context: {
					actionTs: Date.now()
				},
				ident: "body"
			}];

			const raidResult = await Send(JSON.stringify({
				calls: raidCalls
			}));

			if (raidResult && raidResult.results && raidResult.results[0]) {
				const raidData = raidResult.results[0].result.response;
				let totalGold = 0;
				let totalFragments = 0;

				// Calculate total rewards
				for (let i = 0; i < raidCount; i++) {
					if (raidData[i]) {
						if (raidData[i].gold) totalGold += raidData[i].gold;
						if (raidData[i].fragmentScroll) {
							totalFragments += Object.values(raidData[i].fragmentScroll).reduce((a, b) => a + b, 0);
						}
						if (raidData[i].fragmentGear) {
							totalFragments += Object.values(raidData[i].fragmentGear).reduce((a, b) => a + b, 0);
						}
					}
				}

				console.log('%cAuto Raid Mission: Completed!', 'color: green; font-weight: bold;', `Gold: ${totalGold}, Fragments: ${totalFragments}`);
				setProgress(I18N('RAID_MISSIONS_COMPLETED', { 
					missionId: selectedMission.id,
					count: raidCount,
					gold: totalGold,
					fragments: totalFragments
				}), true);
			} else {
				setProgress(I18N('RAID_MISSIONS_FAILED'), true);
			}

		} catch (error) {
			console.error('%cAuto Raid Mission: Error:', 'color: red; font-weight: bold;', error);
			setProgress(I18N('RAID_MISSIONS_ERROR'), true);
		}
	}

	/** Вывести всю клановую статистику в консоль браузера */
	async function clanStatistic() {
		const [dataClanInfo, dataClanStat, dataClanLog] = await Caller.send(['clanGetInfo', 'clanGetWeeklyStat', 'clanGetLog']);

		const membersStat = {};
		for (let i = 0; i < dataClanStat.stat.length; i++) {
			membersStat[dataClanStat.stat[i].id] = dataClanStat.stat[i];
		}

		const joinStat = {};
		historyLog = dataClanLog.history;
		for (let j in historyLog) {
			his = historyLog[j];
			if (his.event == 'join') {
				joinStat[his.userId] = his.ctime;
			}
		}

		const infoArr = [];
		const members = dataClanInfo.clan.members;
		for (let n in members) {
			var member = [
				n,
				members[n].name,
				members[n].level,
				dataClanInfo.clan.warriors.includes(+n) ? 1 : 0,
				(new Date(members[n].lastLoginTime * 1000)).toLocaleString().replace(',', ''),
				joinStat[n] ? (new Date(joinStat[n] * 1000)).toLocaleString().replace(',', '') : '',
				membersStat[n].activity.reverse().join('\t'),
				membersStat[n].adventureStat.reverse().join('\t'),
				membersStat[n].clanGifts.reverse().join('\t'),
				membersStat[n].clanWarStat.reverse().join('\t'),
				membersStat[n].dungeonActivity.reverse().join('\t'),
			];
			infoArr.push(member);
		}
		const info = infoArr.sort((a, b) => (b[2] - a[2])).map((e) => e.join('\t')).join('\n');
		console.log(info);
		copyText(info);
		setProgress(I18N('CLAN_STAT_COPY'), true);
	}

	async function buyInStoreForGold() {
		const result = await Send('{"calls":[{"name":"shopGetAll","args":{},"ident":"body"},{"name":"userGetInfo","args":{},"ident":"userGetInfo"}]}').then(e => e.results.map(n => n.result.response));
		const shops = result[0];
		const user = result[1];
		let gold = user.gold;
		const calls = [];
		if (shops[17]) {
			const slots = shops[17].slots;
			for (let i = 1; i <= 2; i++) {
				if (!slots[i].bought) {
					const costGold = slots[i].cost.gold;
					if ((gold - costGold) < 0) {
						continue;
					}
					gold -= costGold;
					calls.push({
						name: "shopBuy",
						args: {
							shopId: 17,
							slot: i,
							cost: slots[i].cost,
							reward: slots[i].reward,
						},
						ident: 'body_' + i,
					})
				}
			}
		}
		const slots = shops[1].slots;
		for (let i = 4; i <= 6; i++) {
			if (!slots[i].bought && slots[i]?.cost?.gold) {
				const costGold = slots[i].cost.gold;
				if ((gold - costGold) < 0) {
					continue;
				}
				gold -= costGold;
				calls.push({
					name: "shopBuy",
					args: {
						shopId: 1,
						slot: i,
						cost: slots[i].cost,
						reward: slots[i].reward,
					},
					ident: 'body_' + i,
				})
			}
		}

		if (!calls.length) {
			setProgress(I18N('NOTHING_BUY'), true);
			return;
		}

		const resultBuy = await Send(JSON.stringify({ calls })).then(e => e.results.map(n => n.result.response));
		console.log(resultBuy);
		const countBuy = resultBuy.length;
		setProgress(I18N('LOTS_BOUGHT', { countBuy }), true);
	}

	async function rewardsAndMailFarm() {
		try {
			const [questGetAll, mailGetAll, specialOffer, battlePassInfo, battlePassSpecial] = await Caller.send([
				'questGetAll',
				'mailGetAll',
				'specialOffer_getAll',
				'battlePass_getInfo',
				'battlePass_getSpecial',
			]);
			const questsFarm = questGetAll.filter((e) => e.state == 2);
			const mailFarm = mailGetAll?.letters || [];
			const stagesOffers = specialOffer.filter(e => e.offerType === "stagesOffer" && e.farmedStage == -1);

			const listBattlePass = {
				[battlePassInfo.id]: battlePassInfo.battlePass,
				...battlePassSpecial,
			};

			for (const passId in listBattlePass) {
				const battlePass = listBattlePass[passId];
				const levels = Object.values(lib.data.battlePass.level).filter((x) => x.battlePass == passId);
				battlePass.level = Math.max(...levels.filter((p) => battlePass.exp >= p.experience).map((p) => p.level));
			}

			const questBattlePass = lib.getData('quest').battlePass;
			const { questChain: questChainBPass } = lib.getData('battlePass');
			const currentTime = Date.now();

			const farmCaller = new Caller();

			for (const offer of stagesOffers) {
				const offerId = offer.id;
				//const stage = 0 - offer.farmedStage;
				for (const stage of offer.offerData.stages) {
					if (stage.billingId) {
						break;
					}
					farmCaller.add({
						name: 'specialOffer_farmReward',
						args: { offerId },
					});
				}
			}

			const farmQuestIds = [];
			const questIds = [];
			for (let quest of questsFarm) {
				const questId = +quest.id;

				/*
				if ([20010001, 20010002, 20010004].includes(questId)) {
					farmCaller.add({
						name: 'questFarm',
						args: { questId },
					});
					farmQuestIds.push(questId);
					continue;
				}
				*/

				if (questId >= 2001e4 && questId < 14e8) {
					continue;
				}

				if (quest.reward?.battlePassExp) {
					const questInfo = questBattlePass[questId];
					const chain = questChainBPass[questInfo.chain];
					const battlePass = listBattlePass[chain.battlePass];
					if (!battlePass) {
						continue;
					}
					// Наличие золотого билета
					if (chain.requirement?.battlePassTicket && !battlePass.ticket) {
						continue;
					}
					// Соответствие требований по уровню
					if (chain.requirement?.battlePassLevel && battlePass.level < chain.requirement.battlePassLevel) {
						continue;
					}
					const startTime = battlePass.startDate * 1e3;
					const endTime = battlePass.endDate * 1e3;
					// Соответствие даты проведения
					if (startTime > currentTime || endTime < currentTime) {
						continue;
					}
				}

				if (questId >= 2e7 && questId < 14e8) {
					questIds.push(questId);
					farmQuestIds.push(questId);
					continue;
				}

				farmCaller.add({
					name: 'questFarm',
					args: { questId },
				});
				farmQuestIds.push(questId);
			}

			if (questIds.length) {
				farmCaller.add({
					name: 'quest_questsFarm',
					args: { questIds },
				});
			}

			const { Letters } = HWHClasses;
			const letterIds = Letters.filter(mailFarm);
			if (letterIds.length) {
				farmCaller.add({
					name: 'mailFarm',
					args: { letterIds },
				});
			}

			if (farmCaller.isEmpty()) {
				setProgress(I18N('NOTHING_TO_COLLECT'), true);
				return;
			}

			const farmResults = await farmCaller.send();

			let countQuests = 0;
			let countMail = 0;
			let questsIds = [];

			const questFarm = farmResults.result('questFarm', true);
			countQuests += questFarm.length;
			countQuests += questIds.length;
			countMail += Object.keys(farmResults.result('mailFarm')).length;

			const sideResult = farmResults.sideResult('questFarm', true);
			sideResult.push(...farmResults.sideResult('quest_questsFarm', true));

			for (let side of sideResult) {
				const quests = [...(side.newQuests ?? []), ...(side.quests ?? [])];
				for (let quest of quests) {
					if ((quest.id < 1e6 || (quest.id >= 2e7 && quest.id < 2001e4)) && quest.state == 2) {
						questsIds.push(quest.id);
					}
				}
			}
			questsIds = [...new Set(questsIds)];

			while (questsIds.length) {
				const recursiveCaller = new Caller();
				const newQuestIds = [];

				for (let questId of questsIds) {
					if (farmQuestIds.includes(questId)) {
						continue;
					}
					if (questId < 1e6) {
						recursiveCaller.add({
							name: 'questFarm',
							args: { questId },
						});
						farmQuestIds.push(questId);
						countQuests++;
					} else if (questId >= 2e7 && questId < 2001e4) {
						farmQuestIds.push(questId);
						newQuestIds.push(questId);
						countQuests++;
					}
				}

				if (newQuestIds.length) {
					recursiveCaller.add({
						name: 'quest_questsFarm',
						args: { questIds: newQuestIds },
					});
				}

				questsIds = [];
				if (recursiveCaller.isEmpty()) {
					break;
				}

				await recursiveCaller.send();
				const sideResult = recursiveCaller.sideResult('questFarm', true);
				sideResult.push(...recursiveCaller.sideResult('quest_questsFarm', true));

				for (let side of sideResult) {
					const quests = [...(side.newQuests ?? []), ...(side.quests ?? [])];
					for (let quest of quests) {
						if ((quest.id < 1e6 || (quest.id >= 2e7 && quest.id < 2001e4)) && quest.state == 2) {
							questsIds.push(quest.id);
						}
					}
				}
				questsIds = [...new Set(questsIds)];
			}

			setProgress(I18N('COLLECT_REWARDS_AND_MAIL', { countQuests, countMail }), true);
		} catch (error) {
			console.error('Error in questAllFarm:', error);
		}
	}

	class epicBrawl {
		timeout = null;
		time = null;

		constructor() {
			if (epicBrawl.inst) {
				return epicBrawl.inst;
			}
			epicBrawl.inst = this;
			return this;
		}

		runTimeout(func, timeDiff) {
			const worker = new Worker(URL.createObjectURL(new Blob([`
					self.onmessage = function(e) {
						const timeDiff = e.data;

						if (timeDiff > 0) {
							setTimeout(() => {
								self.postMessage(1);
								self.close();
							}, timeDiff);
						}
					};
				`])));
			worker.postMessage(timeDiff);
			worker.onmessage = () => {
				func();
			};
			return true;
		}

		timeDiff(date1, date2) {
			const date1Obj = new Date(date1);
			const date2Obj = new Date(date2);

			const timeDiff = Math.abs(date2Obj - date1Obj);

			const totalSeconds = timeDiff / 1000;
			const minutes = Math.floor(totalSeconds / 60);
			const seconds = Math.floor(totalSeconds % 60);

			const formattedMinutes = String(minutes).padStart(2, '0');
			const formattedSeconds = String(seconds).padStart(2, '0');

			return `${formattedMinutes}:${formattedSeconds}`;
		}

		check() {
			console.log(new Date(this.time))
			if (Date.now() > this.time) {
				this.timeout = null;
				this.start()
				return;
			}
			this.timeout = this.runTimeout(() => this.check(), 6e4);
			return this.timeDiff(this.time, Date.now())
		}

		async start() {
			if (this.timeout) {
				const time = this.timeDiff(this.time, Date.now());
				console.log(new Date(this.time))
				setProgress(I18N('TIMER_ALREADY', { time }), false, hideProgress);
				return;
			}
			setProgress(I18N('EPIC_BRAWL'), false, hideProgress);
			const teamInfo = await Send('{"calls":[{"name":"teamGetAll","args":{},"ident":"teamGetAll"},{"name":"teamGetFavor","args":{},"ident":"teamGetFavor"},{"name":"userGetInfo","args":{},"ident":"userGetInfo"}]}').then(e => e.results.map(n => n.result.response));
			const refill = teamInfo[2].refillable.find(n => n.id == 52)
			this.time = (refill.lastRefill + 3600) * 1000
			const attempts = refill.amount;
			if (!attempts) {
				console.log(new Date(this.time));
				const time = this.check();
				setProgress(I18N('NO_ATTEMPTS_TIMER_START', { time }), false, hideProgress);
				return;
			}

			if (!teamInfo[0].epic_brawl) {
				setProgress(I18N('NO_HEROES_PACK'), false, hideProgress);
				return;
			}

			const args = {
				heroes: teamInfo[0].epic_brawl.filter(e => e < 1000),
				pet: teamInfo[0].epic_brawl.filter(e => e > 6000).pop(),
				favor: teamInfo[1].epic_brawl,
			}

			let wins = 0;
			let coins = 0;
			let streak = { progress: 0, nextStage: 0 };
			for (let i = attempts; i > 0; i--) {
				const info = await Send(JSON.stringify({
					calls: [
						{ name: "epicBrawl_getEnemy", args: {}, ident: "epicBrawl_getEnemy" }, { name: "epicBrawl_startBattle", args, ident: "epicBrawl_startBattle" }
					]
				})).then(e => e.results.map(n => n.result.response));

				const { progress, result } = await Calc(info[1].battle);
				const endResult = await Send(JSON.stringify({ calls: [{ name: "epicBrawl_endBattle", args: { progress, result }, ident: "epicBrawl_endBattle" }, { name: "epicBrawl_getWinStreak", args: {}, ident: "epicBrawl_getWinStreak" }] })).then(e => e.results.map(n => n.result.response));

				const resultInfo = endResult[0].result;
				streak = endResult[1];

				wins += resultInfo.win;
				coins += resultInfo.reward ? resultInfo.reward.coin[39] : 0;

				console.log(endResult[0].result)
				if (endResult[1].progress == endResult[1].nextStage) {
					const farm = await Send('{"calls":[{"name":"epicBrawl_farmWinStreak","args":{},"ident":"body"}]}').then(e => e.results[0].result.response);
					coins += farm.coin[39];
				}

				setProgress(I18N('EPIC_BRAWL_RESULT', {
					i, wins, attempts, coins,
					progress: streak.progress,
					nextStage: streak.nextStage,
					end: '',
				}), false, hideProgress);
			}

			console.log(new Date(this.time));
			const time = this.check();
			setProgress(I18N('EPIC_BRAWL_RESULT', {
				wins, attempts, coins,
				i: '',
				progress: streak.progress,
				nextStage: streak.nextStage,
				end: I18N('ATTEMPT_ENDED', { time }),
			}), false, hideProgress);
		}
	}

	function countdownTimer(seconds, message, onClick = null) {
		message = message || I18N('TIMER');
		const stopTimer = Date.now() + seconds * 1e3;
		const isOnClick = typeof onClick === 'function';
		return new Promise((resolve) => {
			const interval = setInterval(async () => {
				const now = Date.now();
				const remaining = (stopTimer - now) / 1000;
				const clickHandler = isOnClick
					? () => {
							onClick();
							clearInterval(interval);
							setProgress('', true);
							resolve(false);
						}
					: undefined;

				setProgress(`${message} ${remaining.toFixed(2)}`, false, clickHandler);
				if (now > stopTimer) {
					clearInterval(interval);
					setProgress('', true);
					resolve(true);
				}
			}, 100);
		});
	}

	this.HWHFuncs.countdownTimer = countdownTimer;

	/** Набить килов в горниле душк */
	async function bossRatingEventSouls() {
		const data = await Send({
			calls: [
				{ name: "heroGetAll", args: {}, ident: "teamGetAll" },
				{ name: "offerGetAll", args: {}, ident: "offerGetAll" },
				{ name: "pet_getAll", args: {}, ident: "pet_getAll" },
			]
		});
		const bossEventInfo = data.results[1].result.response.find(e => e.offerType == "bossEvent");
		if (!bossEventInfo) {
			setProgress('Эвент завершен', true);
			return;
		}

		if (bossEventInfo.progress.score > 250) {
			setProgress('Уже убито больше 250 врагов');
			rewardBossRatingEventSouls();
			return;
		}
		const availablePets = Object.values(data.results[2].result.response).map(e => e.id);
		const heroGetAllList = data.results[0].result.response;
		const usedHeroes = bossEventInfo.progress.usedHeroes;
		const heroList = [];

		for (let heroId in heroGetAllList) {
			let hero = heroGetAllList[heroId];
			if (usedHeroes.includes(hero.id)) {
				continue;
			}
			heroList.push(hero.id);
		}

		if (!heroList.length) {
			setProgress('Нет героев', true);
			return;
		}

		const pet = availablePets.includes(6005) ? 6005 : availablePets[Math.floor(Math.random() * availablePets.length)];
		const petLib = lib.getData('pet');
		let count = 1;

		for (const heroId of heroList) {
			const args = {
				heroes: [heroId],
				pet
			}
			/** Поиск питомца для героя */
			for (const petId of availablePets) {
				if (petLib[petId].favorHeroes.includes(heroId)) {
					args.favor = {
						[heroId]: petId
					}
					break;
				}
			}

			const calls = [{
				name: "bossRatingEvent_startBattle",
				args,
				ident: "body"
			}, {
				name: "offerGetAll",
				args: {},
				ident: "offerGetAll"
			}];

			const res = await Send({ calls });
			count++;

			if ('error' in res) {
				console.error(res.error);
				setProgress('Перезагрузите игру и попробуйте позже', true);
				return;
			}

			const eventInfo = res.results[1].result.response.find(e => e.offerType == "bossEvent");
			if (eventInfo.progress.score > 250) {
				break;
			}
			setProgress('Количество убитых врагов: ' + eventInfo.progress.score + '<br>Использовано ' + count + ' героев');
		}

		rewardBossRatingEventSouls();
	}
	/** Сбор награды из Горнила Душ */
	async function rewardBossRatingEventSouls() {
		const data = await Send({
			calls: [
				{ name: "offerGetAll", args: {}, ident: "offerGetAll" }
			]
		});

		const bossEventInfo = data.results[0].result.response.find(e => e.offerType == "bossEvent");
		if (!bossEventInfo) {
			setProgress('Эвент завершен', true);
			return;
		}

		const farmedChests = bossEventInfo.progress.farmedChests;
		const score = bossEventInfo.progress.score;
		// setProgress('Количество убитых врагов: ' + score);
		const revard = bossEventInfo.reward;
		const calls = [];

		let count = 0;
		for (let i = 1; i < 10; i++) {
			if (farmedChests.includes(i)) {
				continue;
			}
			if (score < revard[i].score) {
				break;
			}
			calls.push({
				name: "bossRatingEvent_getReward",
				args: {
					rewardId: i
				},
				ident: "body_" + i
			});
			count++;
		}
		if (!count) {
			setProgress('Нечего собирать', true);
			return;
		}

		Send({ calls }).then(e => {
			console.log(e);
			setProgress('Собрано ' + e?.results?.length + ' наград', true);
		})
	}
	/**
	 * Spin the Seer
	 *
	 * Покрутить провидца
	 */
	async function rollAscension() {
		const refillable = await Send({calls:[
			{
				name:"userGetInfo",
				args:{},
				ident:"userGetInfo"
			}
		]}).then(e => e.results[0].result.response.refillable);
		const i47 = refillable.find(i => i.id == 47);
		if (i47?.amount) {
			await Send({ calls: [{ name: "ascensionChest_open", args: { paid: false, amount: 1 }, ident: "body" }] });
			setProgress(I18N('DONE'), true);
		} else {
			setProgress(I18N('NOT_ENOUGH_AP'), true);
		}
	}

	/**
	 * Collect gifts for the New Year
	 *
	 * Собрать подарки на новый год
	 */
	function getGiftNewYear() {
		Send({ calls: [{ name: "newYearGiftGet", args: { type: 0 }, ident: "body" }] }).then(e => {
			const gifts = e.results[0].result.response.gifts;
			const calls = gifts.filter(e => e.opened == 0).map(e => ({
				name: "newYearGiftOpen",
				args: {
					giftId: e.id
				},
				ident: `body_${e.id}`
			}));
			if (!calls.length) {
				setProgress(I18N('NY_NO_GIFTS'), 5000);
				return;
			}
			Send({ calls }).then(e => {
				console.log(e.results)
				const msg = I18N('NY_GIFTS_COLLECTED', { count: e.results.length });
				console.log(msg);
				setProgress(msg, 5000);
			});
		})
	}

	async function updateArtifacts() {
		const count = +await popup.confirm(I18N('SET_NUMBER_LEVELS'), [
			{ msg: I18N('BTN_GO'), isInput: true, default: 10 },
			{ result: false, isClose: true }
		]);
		if (!count) {
			return;
		}
		const quest = new questRun;
		await quest.autoInit();
		const heroes = Object.values(quest.questInfo['heroGetAll']);
		const inventory = quest.questInfo['inventoryGet'];
		const calls = [];
		for (let i = count; i > 0; i--) {
			const upArtifact = quest.getUpgradeArtifact();
			if (!upArtifact.heroId) {
				if (await popup.confirm(I18N('POSSIBLE_IMPROVE_LEVELS', { count: calls.length }), [
					{ msg: I18N('YES'), result: true },
					{ result: false, isClose: true }
				])) {
					break;
				} else {
					return;
				}
			}
			const hero = heroes.find(e => e.id == upArtifact.heroId);
			hero.artifacts[upArtifact.slotId].level++;
			inventory[upArtifact.costCurrency][upArtifact.costId] -= upArtifact.costValue;
			calls.push({
				name: "heroArtifactLevelUp",
				args: {
					heroId: upArtifact.heroId,
					slotId: upArtifact.slotId
				},
				ident: `heroArtifactLevelUp_${i}`
			});
		}

		if (!calls.length) {
			console.log(I18N('NOT_ENOUGH_RESOURECES'));
			setProgress(I18N('NOT_ENOUGH_RESOURECES'), false);
			return;
		}

		await Send(JSON.stringify({ calls })).then(e => {
			if ('error' in e) {
				console.log(I18N('NOT_ENOUGH_RESOURECES'));
				setProgress(I18N('NOT_ENOUGH_RESOURECES'), false);
			} else {
				console.log(I18N('IMPROVED_LEVELS', { count: e.results.length }));
				setProgress(I18N('IMPROVED_LEVELS', { count: e.results.length }), false);
			}
		});
	}

	window.sign = a => {
		const i = this['\x78\x79\x7a'];
		return md5([i['\x6e\x61\x6d\x65'], i['\x76\x65\x72\x73\x69\x6f\x6e'], i['\x61\x75\x74\x68\x6f\x72'], ~(a % 1e3)]['\x6a\x6f\x69\x6e']('\x5f'))
	}

	async function updateSkins() {
		const count = +await popup.confirm(I18N('SET_NUMBER_LEVELS'), [
			{ msg: I18N('BTN_GO'), isInput: true, default: 10 },
			{ result: false, isClose: true }
		]);
		if (!count) {
			return;
		}

		const quest = new questRun;
		await quest.autoInit();
		const heroes = Object.values(quest.questInfo['heroGetAll']);
		const inventory = quest.questInfo['inventoryGet'];
		const calls = [];
		for (let i = count; i > 0; i--) {
			const upSkin = quest.getUpgradeSkin();
			if (!upSkin.heroId) {
				if (await popup.confirm(I18N('POSSIBLE_IMPROVE_LEVELS', { count: calls.length }), [
					{ msg: I18N('YES'), result: true },
					{ result: false, isClose: true }
				])) {
					break;
				} else {
					return;
				}
			}
			const hero = heroes.find(e => e.id == upSkin.heroId);
			hero.skins[upSkin.skinId]++;
			inventory[upSkin.costCurrency][upSkin.costCurrencyId] -= upSkin.cost;
			calls.push({
				name: "heroSkinUpgrade",
				args: {
					heroId: upSkin.heroId,
					skinId: upSkin.skinId
				},
				ident: `heroSkinUpgrade_${i}`
			})
		}

		if (!calls.length) {
			console.log(I18N('NOT_ENOUGH_RESOURECES'));
			setProgress(I18N('NOT_ENOUGH_RESOURECES'), false);
			return;
		}

		await Send(JSON.stringify({ calls })).then(e => {
			if ('error' in e) {
				console.log(I18N('NOT_ENOUGH_RESOURECES'));
				setProgress(I18N('NOT_ENOUGH_RESOURECES'), false);
			} else {
				console.log(I18N('IMPROVED_LEVELS', { count: e.results.length }));
				setProgress(I18N('IMPROVED_LEVELS', { count: e.results.length }), false);
			}
		});
	}

	function getQuestionInfo(img, nameOnly = false) {
		const libHeroes = Object.values(lib.data.hero);
		const parts = img.split(':');
		const id = parts[1];
		switch (parts[0]) {
			case 'titanArtifact_id':
				return cheats.translate("LIB_TITAN_ARTIFACT_NAME_" + id);
			case 'titan':
				return cheats.translate("LIB_HERO_NAME_" + id);
			case 'skill':
				return cheats.translate("LIB_SKILL_" + id);
			case 'inventoryItem_gear':
				return cheats.translate("LIB_GEAR_NAME_" + id);
			case 'inventoryItem_coin':
				return cheats.translate("LIB_COIN_NAME_" + id);
			case 'artifact':
				if (nameOnly) {
					return cheats.translate("LIB_ARTIFACT_NAME_" + id);
				}
				heroes = libHeroes.filter(h => h.id < 100 && h.artifacts.includes(+id));
				return {
					/** Как называется этот артефакт? */
					name: cheats.translate("LIB_ARTIFACT_NAME_" + id),
					/** Какому герою принадлежит этот артефакт? */
					heroes: heroes.map(h => cheats.translate("LIB_HERO_NAME_" + h.id))
				};
			case 'hero':
				if (nameOnly) {
					return cheats.translate("LIB_HERO_NAME_" + id);
				}
				artifacts = lib.data.hero[id].artifacts;
				return {
					/** Как зовут этого героя? */
					name: cheats.translate("LIB_HERO_NAME_" + id),
					/** Какой артефакт принадлежит этому герою? */
					artifact: artifacts.map(a => cheats.translate("LIB_ARTIFACT_NAME_" + a))
				};
		}
	}

	function hintQuest(quest) {
		const result = {};
		if (quest?.questionIcon) {
			const info = getQuestionInfo(quest.questionIcon);
			if (info?.heroes) {
				/** Какому герою принадлежит этот артефакт? */
				result.answer = quest.answers.filter(e => info.heroes.includes(e.answerText.slice(1)));
			}
			if (info?.artifact) {
				/** Какой артефакт принадлежит этому герою? */
				result.answer = quest.answers.filter(e => info.artifact.includes(e.answerText.slice(1)));
			}
			if (typeof info == 'string') {
				result.info = { name: info };
			} else {
				result.info = info;
			}
		}

		if (quest.answers[0]?.answerIcon) {
			result.answer = quest.answers.filter(e => quest.question.includes(getQuestionInfo(e.answerIcon, true)))
		}

		if ((!result?.answer || !result.answer.length) && !result.info?.name) {
			return false;
		}

		let resultText = '';
		if (result?.info) {
			resultText += I18N('PICTURE') + result.info.name;
		}
		console.log(result);
		if (result?.answer && result.answer.length) {
			resultText += I18N('ANSWER') + result.answer[0].id + (!result.answer[0].answerIcon ? ' - ' + result.answer[0].answerText : '');
		}

		return resultText;
	}

	async function farmBattlePass() {
		const isFarmReward = (reward) => {
			return !(reward?.buff || reward?.fragmentHero || reward?.bundleHeroReward);
		};

		const battlePassProcess = (pass) => {
			if (!pass.id) {return []}
			const levels = Object.values(lib.data.battlePass.level).filter(x => x.battlePass == pass.id)
			const last_level = levels[levels.length - 1];
			let actual = Math.max(...levels.filter(p => pass.exp >= p.experience).map(p => p.level))

			if (pass.exp > last_level.experience) {
				actual = last_level.level + (pass.exp - last_level.experience) / last_level.experienceByLevel;
			}
			const calls = [];
			for(let i = 1; i <= actual; i++) {
				const level = i >= last_level.level ? last_level : levels.find(l => l.level === i);
				const reward = {free: level?.freeReward, paid:level?.paidReward};

				if (!pass.rewards[i]?.free && isFarmReward(reward.free)) {
					const args = {level: i, free:true};
					if (!pass.gold) { args.id = pass.id }
					calls.push({ name: 'battlePass_farmReward', args, ident: `${pass.gold ? 'body' : 'spesial'}_free_${args.id}_${i}` });
				}
				if (pass.ticket && !pass.rewards[i]?.paid && isFarmReward(reward.paid)) {
					const args = {level: i, free:false};
					if (!pass.gold) { args.id = pass.id}
					calls.push({ name: 'battlePass_farmReward', args, ident: `${pass.gold ? 'body' : 'spesial'}_paid_${args.id}_${i}` });
				}
			}
			return calls;
		}

		const passes = await Send({
			calls: [
				{ name: 'battlePass_getInfo', args: {}, ident: 'getInfo' },
				{ name: 'battlePass_getSpecial', args: {}, ident: 'getSpecial' },
			],
		}).then((e) => [{...e.results[0].result.response?.battlePass, gold: true}, ...Object.values(e.results[1].result.response)]);

		const calls = passes.map(p => battlePassProcess(p)).flat()

		if (!calls.length) {
			setProgress(I18N('NOTHING_TO_COLLECT'));
			return;
		}

		let results = await Send({calls});
		if (results.error) {
			console.log(results.error);
			setProgress(I18N('SOMETHING_WENT_WRONG'));
		} else {
			setProgress(I18N('SEASON_REWARD_COLLECTED', {count: results.results.length}), true);
		}
	}

	async function sellHeroSoulsForGold() {
		let { fragmentHero, heroes } = await Send({
			calls: [
				{ name: 'inventoryGet', args: {}, ident: 'inventoryGet' },
				{ name: 'heroGetAll', args: {}, ident: 'heroGetAll' },
			],
		})
			.then((e) => e.results.map((r) => r.result.response))
			.then((e) => ({ fragmentHero: e[0].fragmentHero, heroes: e[1] }));

		const calls = [];
		for (let i in fragmentHero) {
			if (heroes[i] && heroes[i].star == 6) {
				calls.push({
					name: 'inventorySell',
					args: {
						type: 'hero',
						libId: i,
						amount: fragmentHero[i],
						fragment: true,
					},
					ident: 'inventorySell_' + i,
				});
			}
		}
		if (!calls.length) {
			console.log(0);
			return 0;
		}
		const rewards = await Send({ calls }).then((e) => e.results.map((r) => r.result?.response?.gold || 0));
		const gold = rewards.reduce((e, a) => e + a, 0);
		setProgress(I18N('GOLD_RECEIVED', { gold }), true);
	}

	/**
	 * Attack of the minions of Asgard
	 *
	 * Атака прислужников Асгарда
	 */
	function testRaidNodes() {
		const { executeRaidNodes } = HWHClasses;
		return new Promise((resolve, reject) => {
			const tower = new executeRaidNodes(resolve, reject);
			tower.start();
		});
	}

	/**
	 * Auto-run minions attack on Mondays
	 * Автоматический запуск атаки прислужников по понедельникам
	 */
	function autoRunMinionsOnMonday() {
		const today = new Date();
		const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, 2 = Tuesday, etc.
		
		// Check if today is Monday (day 1)
		if (dayOfWeek === 1) {
			console.log('🎯 Monday detected - Auto-running minions attack...');
			setProgress(I18N('MONDAY_DETECTED'), false);
			
			// Run minions attack automatically
			testRaidNodes().then(() => {
				console.log('✅ Minions attack completed successfully');
				setProgress(I18N('MONDAY_COMPLETED'), true);
			}).catch((error) => {
				console.error('❌ Minions attack failed:', error);
				setProgress(I18N('MONDAY_FAILED'), true);
			});
		} else {
			const dayName = getDayName(dayOfWeek);
			console.log(`📅 Today is ${dayName} - Minions auto-run only on Mondays`);
			setProgress(I18N('MONDAY_NOT_TODAY', { day: dayName }), false);
		}
	}

	/**
	 * Get day name for logging
	 * Получить название дня для логирования
	 */
	function getDayName(dayOfWeek) {
		const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
		return days[dayOfWeek];
	}

	/**
	 * Attack of the minions of Asgard
	 *
	 * Атака прислужников Асгарда
	 */
	function executeRaidNodes(resolve, reject) {
		let raidData = {
			teams: [],
			favor: {},
			nodes: [],
			attempts: 0,
			countExecuteBattles: 0,
			cancelBattle: 0,
		}

		callsExecuteRaidNodes = {
			calls: [{
				name: "clanRaid_getInfo",
				args: {},
				ident: "clanRaid_getInfo"
			}, {
				name: "teamGetAll",
				args: {},
				ident: "teamGetAll"
			}, {
				name: "teamGetFavor",
				args: {},
				ident: "teamGetFavor"
			}]
		}

		this.start = function () {
			send(JSON.stringify(callsExecuteRaidNodes), startRaidNodes);
		}

		async function startRaidNodes(data) {
			res = data.results;
			clanRaidInfo = res[0].result.response;
			teamGetAll = res[1].result.response;
			teamGetFavor = res[2].result.response;

			let index = 0;
			let isNotFullPack = false;
			for (let team of teamGetAll.clanRaid_nodes) {
				if (team.length < 6) {
					isNotFullPack = true;
				}
				raidData.teams.push({
					data: {},
					heroes: team.filter(id => id < 6000),
					pet: team.filter(id => id >= 6000).pop(),
					battleIndex: index++
				});
			}
			raidData.favor = teamGetFavor.clanRaid_nodes;

			if (isNotFullPack) {
				if (await popup.confirm(I18N('MINIONS_WARNING'), [
					{ msg: I18N('BTN_NO'), result: true },
					{ msg: I18N('BTN_YES'), result: false },
				])) {
					endRaidNodes('isNotFullPack');
					return;
				}
			}

			raidData.nodes = clanRaidInfo.nodes;
			raidData.attempts = clanRaidInfo.attempts;
			setIsCancalBattle(false);

			checkNodes();
		}

		function getAttackNode() {
			for (let nodeId in raidData.nodes) {
				let node = raidData.nodes[nodeId];
				let points = 0
				for (team of node.teams) {
					points += team.points;
				}
				let now = Date.now() / 1000;
				if (!points && now > node.timestamps.start && now < node.timestamps.end) {
					let countTeam = node.teams.length;
					delete raidData.nodes[nodeId];
					return {
						nodeId,
						countTeam
					};
				}
			}
			return null;
		}

		function checkNodes() {
			setProgress(`${I18N('REMAINING_ATTEMPTS')}: ${raidData.attempts}`);
			let nodeInfo = getAttackNode();
			if (nodeInfo && raidData.attempts) {
				startNodeBattles(nodeInfo);
				return;
			}

			endRaidNodes('EndRaidNodes');
		}

		function startNodeBattles(nodeInfo) {
			let {nodeId, countTeam} = nodeInfo;
			let teams = raidData.teams.slice(0, countTeam);
			let heroes = raidData.teams.map(e => e.heroes).flat();
			let favor = {...raidData.favor};
			for (let heroId in favor) {
				if (!heroes.includes(+heroId)) {
					delete favor[heroId];
				}
			}

			let calls = [{
				name: "clanRaid_startNodeBattles",
				args: {
					nodeId,
					teams,
					favor
				},
				ident: "body"
			}];

			send(JSON.stringify({calls}), resultNodeBattles);
		}

		function resultNodeBattles(e) {
			if (e['error']) {
				endRaidNodes('nodeBattlesError', e['error']);
				return;
			}

			console.log(e);
			let battles = e.results[0].result.response.battles;
			let promises = [];
			let battleIndex = 0;
			for (let battle of battles) {
				battle.battleIndex = battleIndex++;
				promises.push(calcBattleResult(battle));
			}

			Promise.all(promises)
				.then(results => {
					const endResults = {};
					let isAllWin = true;
					for (let r of results) {
						isAllWin &&= r.result.win;
					}
					if (!isAllWin) {
						cancelEndNodeBattle(results[0]);
						return;
					}
					raidData.countExecuteBattles = results.length;
					let timeout = 500;
					for (let r of results) {
						setTimeout(endNodeBattle, timeout, r);
						timeout += 500;
					}
				});
		}
		/**
		 * Returns the battle calculation promise
		 *
		 * Возвращает промис расчета боя
		 */
		function calcBattleResult(battleData) {
			return new Promise(function (resolve, reject) {
				BattleCalc(battleData, "get_clanPvp", resolve);
			});
		}
		/**
		 * Cancels the fight
		 *
		 * Отменяет бой
		 */
		function cancelEndNodeBattle(r) {
			const fixBattle = function (heroes) {
				for (const ids in heroes) {
					hero = heroes[ids];
					hero.energy = random(1, 999);
					if (hero.hp > 0) {
						hero.hp = random(1, hero.hp);
					}
				}
			}
			fixBattle(r.progress[0].attackers.heroes);
			fixBattle(r.progress[0].defenders.heroes);
			endNodeBattle(r);
		}
		/**
		 * Ends the fight
		 *
		 * Завершает бой
		 */
		function endNodeBattle(r) {
			let nodeId = r.battleData.result.nodeId;
			let battleIndex = r.battleData.battleIndex;
			let calls = [{
				name: "clanRaid_endNodeBattle",
				args: {
					nodeId,
					battleIndex,
					result: r.result,
					progress: r.progress
				},
				ident: "body"
			}]

			SendRequest(JSON.stringify({calls}), battleResult);
		}
		/**
		 * Processing the results of the battle
		 *
		 * Обработка результатов боя
		 */
		function battleResult(e) {
			if (e['error']) {
				endRaidNodes('missionEndError', e['error']);
				return;
			}
			r = e.results[0].result.response;
			if (r['error']) {
				if (r.reason == "invalidBattle") {
					raidData.cancelBattle++;
					checkNodes();
				} else {
					endRaidNodes('missionEndError', e['error']);
				}
				return;
			}

			if (!(--raidData.countExecuteBattles)) {
				raidData.attempts--;
				checkNodes();
			}
		}
		/**
		 * Completing a task
		 *
		 * Завершение задачи
		 */
		function endRaidNodes(reason, info) {
			setIsCancalBattle(true);
			let textCancel = raidData.cancelBattle ? ` ${I18N('BATTLES_CANCELED')}: ${raidData.cancelBattle}` : '';
			setProgress(`${I18N('MINION_RAID')} ${I18N('COMPLETED')}! ${textCancel}`, true);
			console.log(reason, info);
			resolve();
		}
	}

	this.HWHClasses.executeRaidNodes = executeRaidNodes;

	/**
	 * Asgard Boss Attack Replay
	 *
	 * Повтор атаки босса Асгарда
	 */
	function testBossBattle() {
		const { executeBossBattle } = HWHClasses;
		return new Promise((resolve, reject) => {
			const bossBattle = new executeBossBattle(resolve, reject);
			bossBattle.start(lastBossBattle);
		});
	}

	/**
	 * Asgard Boss Attack Replay
	 *
	 * Повтор атаки босса Асгарда
	 */
	function executeBossBattle(resolve, reject) {

		this.start = function (battleInfo) {
			preCalcBattle(battleInfo);
		}

		function getBattleInfo(battle) {
			return new Promise(function (resolve) {
				battle.seed = Math.floor(Date.now() / 1000) + random(0, 1e3);
				BattleCalc(battle, getBattleType(battle.type), e => {
					let extra = e.progress[0].defenders.heroes[1].extra;
					resolve(extra.damageTaken + extra.damageTakenNextLevel);
				});
			});
		}

		function preCalcBattle(battle) {
			let actions = [];
			const countTestBattle = getInput('countTestBattle');
			for (let i = 0; i < countTestBattle; i++) {
				actions.push(getBattleInfo(battle, true));
			}
			Promise.all(actions)
				.then(resultPreCalcBattle);
		}

		async function resultPreCalcBattle(damages) {
			let maxDamage = 0;
			let minDamage = 1e10;
			let avgDamage = 0;
			for (let damage of damages) {
				avgDamage += damage
				if (damage > maxDamage) {
					maxDamage = damage;
				}
				if (damage < minDamage) {
					minDamage = damage;
				}
			}
			avgDamage /= damages.length;
			console.log(damages.map(e => e.toLocaleString()).join('\n'), avgDamage, maxDamage);

			await popup.confirm(
				`${I18N('ROUND_STAT')} ${damages.length} ${I18N('BATTLE')}:` +
				`<br>${I18N('MINIMUM')}: ` + minDamage.toLocaleString() +
				`<br>${I18N('MAXIMUM')}: ` + maxDamage.toLocaleString() +
				`<br>${I18N('AVERAGE')}: ` + avgDamage.toLocaleString()
				, [
					{ msg: I18N('BTN_OK'), result: 0},
				])
			endBossBattle(I18N('BTN_CANCEL'));
		}

		/**
		 * Completing a task
		 *
		 * Завершение задачи
		 */
		function endBossBattle(reason, info) {
			console.log(reason, info);
			resolve();
		}
	}

	this.HWHClasses.executeBossBattle = executeBossBattle;

	class FixBattle {
		minTimer = 1.3;
		maxTimer = 15.3;

		constructor(battle, isTimeout = true) {
			this.battle = structuredClone(battle);
			this.isTimeout = isTimeout;
			this.isGetTimer = true;
		}

		timeout(callback, timeout) {
			if (this.isTimeout) {
				this.worker.postMessage(timeout);
				this.worker.onmessage = callback;
			} else {
				callback();
			}
		}

		randTimer() {
			return Math.random() * (this.maxTimer - this.minTimer + 1) + this.minTimer;
		}

		getTimer() {
			if (this.count === 1) {
				this.initTimers();
			}

			return this.battleLogTimers[this.count];
		}

		setAvgTime(startTime) {
			this.fixTime += Date.now() - startTime;
			this.avgTime = this.fixTime / this.count;
		}

		initTimers() {
			const timers = [...new Set(this.lastResult.battleLogs[0].map((e) => e.time))];
			this.battleLogTimers = timers.sort(() => Math.random() - 0.5);
			this.maxCount = Math.min(this.maxCount, this.battleLogTimers.length);
			console.log('maxCount', this.maxCount);
		}

		init() {
			this.fixTime = 0;
			this.lastTimer = 0;
			this.index = 0;
			this.lastBossDamage = 0;
			this.bestResult = {
				count: 0,
				timer: 0,
				value: -Infinity,
				result: null,
				progress: null,
			};
			this.lastBattleResult = {
				win: false,
			};
			this.worker = new Worker(
				URL.createObjectURL(
					new Blob([
						`self.onmessage = function(e) {
								const timeout = e.data;
								setTimeout(() => {
									self.postMessage(1);
								}, timeout);
							};`,
					])
				)
			);
		}

		async start(endTime = Date.now() + 6e4, maxCount = 100) {
			this.endTime = endTime;
			this.maxCount = maxCount;
			this.init();
			return await new Promise((resolve) => {
				this.resolve = resolve;
				this.count = 0;
				this.loop();
			});
		}

		endFix() {
			this.bestResult.maxCount = this.count;
			this.worker.terminate();
			console.log('endFix', this.bestResult);
			this.resolve(this.bestResult);
		}

		async loop() {
			const start = Date.now();
			if (this.isEndLoop()) {
				this.endFix();
				return;
			}
			this.count++;
			try {
				this.lastResult = await Calc(this.battle);
			} catch (e) {
				this.updateProgressTimer(this.index++);
				this.timeout(this.loop.bind(this), 0);
				return;
			}
			const { progress, result } = this.lastResult;
			this.lastBattleResult = result;
			this.lastBattleProgress = progress;
			this.setAvgTime(start);
			this.checkResult();
			this.showResult();
			this.updateProgressTimer();
			this.timeout(this.loop.bind(this), 0);
		}

		isEndLoop() {
			return this.count >= this.maxCount || this.endTime < Date.now();
		}

		updateProgressTimer(index = 0) {
			this.lastTimer = this.isGetTimer ? this.getTimer() : this.randTimer();
			this.battle.progress = [{ attackers: { input: ['auto', 0, 0, 'auto', index, this.lastTimer] } }];
		}

		showResult() {
			console.log(
				this.count,
				this.avgTime.toFixed(2),
				(this.endTime - Date.now()) / 1000,
				this.lastTimer.toFixed(2),
				this.lastBossDamage.toLocaleString(),
				this.bestResult.value.toLocaleString()
			);
		}

		checkResult() {
			const { damageTaken, damageTakenNextLevel } = this.lastBattleProgress[0].defenders.heroes[1].extra;
			this.lastBossDamage = damageTaken + damageTakenNextLevel;
			if (this.lastBossDamage > this.bestResult.value) {
				this.bestResult = {
					count: this.count,
					timer: this.lastTimer,
					value: this.lastBossDamage,
					result: structuredClone(this.lastBattleResult),
					progress: structuredClone(this.lastBattleProgress),
				};
			}
		}

		stopFix() {
			this.endTime = 0;
		}
	}

	this.HWHClasses.FixBattle = FixBattle;

	class WinFixBattle extends FixBattle {
		checkResult() {
			if (this.lastBattleResult.win) {
				this.bestResult = {
					count: this.count,
					timer: this.lastTimer,
					value: this.lastBattleResult.stars,
					result: structuredClone(this.lastBattleResult),
					progress: structuredClone(this.lastBattleProgress),
					battleTimer: this.lastResult.battleTimer,
				};
			}
		}

		setWinTimer(value) {
			this.winTimer = value;
		}

		setMaxTimer(value) {
			this.maxTimer = value;
		}

		randTimer() {
			if (this.winTimer) {
				return this.winTimer;
			}
			return super.randTimer();
		}

		isEndLoop() {
			return super.isEndLoop() || this.bestResult.result?.win;
		}

		showResult() {
			console.log(
				this.count,
				this.avgTime.toFixed(2),
				(this.endTime - Date.now()) / 1000,
				this.lastResult.battleTime,
				this.lastTimer,
				this.bestResult.value
			);
			const endTime = ((this.endTime - Date.now()) / 1000).toFixed(2);
			const avgTime = this.avgTime.toFixed(2);
			const msg = `${I18N('LETS_FIX')} ${this.count}/${this.maxCount}<br/>${endTime}s<br/>${avgTime}ms`;
			setProgress(msg, false, this.stopFix.bind(this));
		}
	}

	this.HWHClasses.WinFixBattle = WinFixBattle;

	class BestOrWinFixBattle extends WinFixBattle {
		isNoMakeWin = false;

		getState(result) {
			let beforeSumFactor = 0;
			const beforeHeroes = result.battleData.defenders[0];
			for (let heroId in beforeHeroes) {
				const hero = beforeHeroes[heroId];
				const state = hero.state;
				let factor = 1;
				if (state) {
					const hp = state.hp / (hero?.hp || 1);
					const energy = state.energy / 1e3;
					factor = hp + energy / 20;
				}
				beforeSumFactor += factor;
			}

			let afterSumFactor = 0;
			const afterHeroes = result.progress[0].defenders.heroes;
			for (let heroId in afterHeroes) {
				const hero = afterHeroes[heroId];
				const hp = hero.hp / (beforeHeroes[heroId]?.hp || 1);
				const energy = hero.energy / 1e3;
				const factor = hp + energy / 20;
				afterSumFactor += factor;
			}
			return 100 - Math.floor((afterSumFactor / beforeSumFactor) * 1e4) / 100;
		}

		setNoMakeWin(value) {
			this.isNoMakeWin = value;
		}

		checkResult() {
			const state = this.getState(this.lastResult);
			console.log(state);

			if (state > this.bestResult.value) {
				if (!(this.isNoMakeWin && this.lastBattleResult.win)) {
					this.bestResult = {
						count: this.count,
						timer: this.lastTimer,
						value: state,
						result: structuredClone(this.lastBattleResult),
						progress: structuredClone(this.lastBattleProgress),
						battleTimer: this.lastResult.battleTimer,
					};
				}
			}
		}
	}

	this.HWHClasses.BestOrWinFixBattle = BestOrWinFixBattle;

	class BossFixBattle extends FixBattle {
		showResult() {
			super.showResult();
			//setTimeout(() => {
				const best = this.bestResult;
				const maxDmg = best.value.toLocaleString();
				const avgTime = this.avgTime.toLocaleString();
				const msg = `${I18N('LETS_FIX')} ${this.count}/${this.maxCount}<br/>${maxDmg}<br/>${avgTime}ms`;
				setProgress(msg, false, this.stopFix.bind(this));
			//}, 0);
		}
	}

	this.HWHClasses.BossFixBattle = BossFixBattle;

	class DungeonFixBattle extends FixBattle {
		init() {
			super.init();
			this.isTimeout = false;
			this.bestResult = {
				count: 0,
				timer: 0,
				value: {
					hp: -Infinity,
					energy: -Infinity,
				},
				result: null,
				progress: null,
			};
		}

		setState() {
			const result = this.lastResult;
			const isAllDead = Object.values(result.progress[0].attackers.heroes).every((item) => item.isDead);
			if (isAllDead) {
				this.lastState = {
					hp: -Infinity,
					energy: -Infinity,
				};
				return;
			}
			let beforeHP = 0;
			let beforeEnergy = 0;
			const beforeTitans = result.battleData.attackers;
			for (let titanId in beforeTitans) {
				const titan = beforeTitans[titanId];
				const state = titan.state;
				if (state) {
					beforeHP += state.hp / titan.hp;
					beforeEnergy += state.energy / 1e3;
				}
			}

			let afterHP = 0;
			let afterEnergy = 0;
			const afterTitans = result.progress[0].attackers.heroes;
			for (let titanId in afterTitans) {
				const titan = afterTitans[titanId];
				afterHP += titan.hp / beforeTitans[titanId].hp;
				afterEnergy += titan.energy / 1e3;
			}

			this.lastState = {
				hp: afterHP - beforeHP,
				energy: afterEnergy - beforeEnergy,
			};
		}

		checkResult() {
			this.setState();
			if (
				this.lastState.hp > this.bestResult.value.hp ||
				(this.lastState.hp === this.bestResult.value.hp && this.lastState.energy > this.bestResult.value.energy)
			) {
				this.bestResult = {
					count: this.count,
					timer: this.lastTimer,
					value: this.lastState,
					result: this.lastResult.result,
					progress: this.lastResult.progress,
				};
			}
		}

		showResult() {
			if (this.isShowResult) {
				console.log(this.count, this.lastTimer.toFixed(2), JSON.stringify(this.lastState), JSON.stringify(this.bestResult.value));
			}
		}
	}

	this.HWHClasses.DungeonFixBattle = DungeonFixBattle;

	const masterWsMixin = {
		wsStart() {
			const socket = new WebSocket(this.url);

			socket.onopen = () => {
				console.log('Connected to server');

				// Пример создания новой задачи
				const newTask = {
					type: 'newTask',
					battle: this.battle,
					endTime: this.endTime - 1e4,
					maxCount: this.maxCount,
				};
				socket.send(JSON.stringify(newTask));
			};

			socket.onmessage = this.onmessage.bind(this);

			socket.onclose = () => {
				console.log('Disconnected from server');
			};

			this.ws = socket;
		},

		onmessage(event) {
			const data = JSON.parse(event.data);
			switch (data.type) {
				case 'newTask': {
					console.log('newTask:', data);
					this.id = data.id;
					this.countExecutor = data.count;
					break;
				}
				case 'getSolTask': {
					console.log('getSolTask:', data);
					this.endFix(data.solutions);
					break;
				}
				case 'resolveTask': {
					console.log('resolveTask:', data);
					if (data.id === this.id && data.solutions.length === this.countExecutor) {
						this.worker.terminate();
						this.endFix(data.solutions);
					}
					break;
				}
				default:
					console.log('Unknown message type:', data.type);
			}
		},

		getTask() {
			this.ws.send(
				JSON.stringify({
					type: 'getSolTask',
					id: this.id,
				})
			);
		},
	};

	/*
	mFix = new action.masterFixBattle(battle)
	await mFix.start(Date.now() + 6e4, 1);
	*/
	class masterFixBattle extends FixBattle {
		constructor(battle, url = 'wss://localho.st:3000') {
			super(battle, true);
			this.url = url;
		}

		async start(endTime, maxCount) {
			this.endTime = endTime;
			this.maxCount = maxCount;
			this.init();
			this.wsStart();
			return await new Promise((resolve) => {
				this.resolve = resolve;
				const timeout = this.endTime - Date.now();
				this.timeout(this.getTask.bind(this), timeout);
			});
		}

		async endFix(solutions) {
			this.ws.close();
			let maxCount = 0;
			for (const solution of solutions) {
				maxCount += solution.maxCount;
				if (solution.value > this.bestResult.value) {
					this.bestResult = solution;
				}
			}
			this.count = maxCount;
			super.endFix();
		}
	}

	Object.assign(masterFixBattle.prototype, masterWsMixin);

	this.HWHClasses.masterFixBattle = masterFixBattle;

	class masterWinFixBattle extends WinFixBattle {
		constructor(battle, url = 'wss://localho.st:3000') {
			super(battle, true);
			this.url = url;
		}

		async start(endTime, maxCount) {
			this.endTime = endTime;
			this.maxCount = maxCount;
			this.init();
			this.wsStart();
			return await new Promise((resolve) => {
				this.resolve = resolve;
				const timeout = this.endTime - Date.now();
				this.timeout(this.getTask.bind(this), timeout);
			});
		}

		async endFix(solutions) {
			this.ws.close();
			let maxCount = 0;
			for (const solution of solutions) {
				maxCount += solution.maxCount;
				if (solution.value > this.bestResult.value) {
					this.bestResult = solution;
				}
			}
			this.count = maxCount;
			super.endFix();
		}
	}

	Object.assign(masterWinFixBattle.prototype, masterWsMixin);

	this.HWHClasses.masterWinFixBattle = masterWinFixBattle;

	const slaveWsMixin = {
		wsStop() {
			this.ws.close();
		},

		wsStart() {
			const socket = new WebSocket(this.url);

			socket.onopen = () => {
				console.log('Connected to server');
			};
			socket.onmessage = this.onmessage.bind(this);
			socket.onclose = () => {
				console.log('Disconnected from server');
			};

			this.ws = socket;
		},

		async onmessage(event) {
			const data = JSON.parse(event.data);
			switch (data.type) {
				case 'newTask': {
					console.log('newTask:', data.task);
					const { battle, endTime, maxCount } = data.task;
					this.battle = battle;
					const id = data.task.id;
					const solution = await this.start(endTime, maxCount);
					this.ws.send(
						JSON.stringify({
							type: 'resolveTask',
							id,
							solution,
						})
					);
					break;
				}
				default:
					console.log('Unknown message type:', data.type);
			}
		},
	};
	/*
	sFix = new action.slaveFixBattle();
	sFix.wsStart()
	*/
	class slaveFixBattle extends FixBattle {
		constructor(url = 'wss://localho.st:3000') {
			super(null, false);
			this.isTimeout = false;
			this.url = url;
		}
	}

	Object.assign(slaveFixBattle.prototype, slaveWsMixin);

	this.HWHClasses.slaveFixBattle = slaveFixBattle;

	class slaveWinFixBattle extends WinFixBattle {
		constructor(url = 'wss://localho.st:3000') {
			super(null, false);
			this.isTimeout = false;
			this.url = url;
		}
	}

	Object.assign(slaveWinFixBattle.prototype, slaveWsMixin);

	this.HWHClasses.slaveWinFixBattle = slaveWinFixBattle;
	/**
	 * Auto-repeat attack
	 *
	 * Автоповтор атаки
	 */
	function testAutoBattle() {
		const { executeAutoBattle } = HWHClasses;
		return new Promise((resolve, reject) => {
			const bossBattle = new executeAutoBattle(resolve, reject);
			bossBattle.start(lastBattleArg, lastBattleInfo);
		});
	}

	/**
	 * Auto-repeat attack
	 *
	 * Автоповтор атаки
	 */
	function executeAutoBattle(resolve, reject) {
		let battleArg = {};
		let countBattle = 0;
		let countError = 0;
		let findCoeff = 0;
		let dataNotEeceived = 0;
		let stopAutoBattle = false;

		let isSetWinTimer = false;
		const svgJustice = '<svg width="20" height="20" viewBox="0 0 124 125" xmlns="http://www.w3.org/2000/svg" style="fill: #fff;"><g><path d="m54 0h-1c-7.25 6.05-17.17 6.97-25.78 10.22-8.6 3.25-23.68 1.07-23.22 12.78s-0.47 24.08 1 35 2.36 18.36 7 28c4.43-8.31-3.26-18.88-3-30 0.26-11.11-2.26-25.29-1-37 11.88-4.16 26.27-0.42 36.77-9.23s20.53 6.05 29.23-0.77c-6.65-2.98-14.08-4.96-20-9z"/></g><g><path d="m108 5c-11.05 2.96-27.82 2.2-35.08 11.92s-14.91 14.71-22.67 23.33c-7.77 8.62-14.61 15.22-22.25 23.75 7.05 11.93 14.33 2.58 20.75-4.25 6.42-6.82 12.98-13.03 19.5-19.5s12.34-13.58 19.75-18.25c2.92 7.29-8.32 12.65-13.25 18.75-4.93 6.11-12.19 11.48-17.5 17.5s-12.31 11.38-17.25 17.75c10.34 14.49 17.06-3.04 26.77-10.23s15.98-16.89 26.48-24.52c10.5-7.64 12.09-24.46 14.75-36.25z"/></g><g><path d="m60 25c-11.52-6.74-24.53 8.28-38 6 0.84 9.61-1.96 20.2 2 29 5.53-4.04-4.15-23.2 4.33-26.67 8.48-3.48 18.14-1.1 24.67-8.33 2.73 0.3 4.81 2.98 7 0z"/></g><g><path d="m100 75c3.84-11.28 5.62-25.85 3-38-4.2 5.12-3.5 13.58-4 20s-3.52 13.18 1 18z"/></g><g><path d="m55 94c15.66-5.61 33.71-20.85 29-39-3.07 8.05-4.3 16.83-10.75 23.25s-14.76 8.35-18.25 15.75z"/></g><g><path d="m0 94v7c6.05 3.66 9.48 13.3 18 11-3.54-11.78 8.07-17.05 14-25 6.66 1.52 13.43 16.26 19 5-11.12-9.62-20.84-21.33-32-31-9.35 6.63 4.76 11.99 6 19-7.88 5.84-13.24 17.59-25 14z"/></g><g><path d="m82 125h26v-19h16v-1c-11.21-8.32-18.38-21.74-30-29-8.59 10.26-19.05 19.27-27 30h15v19z"/></g><g><path d="m68 110c-7.68-1.45-15.22 4.83-21.92-1.08s-11.94-5.72-18.08-11.92c-3.03 8.84 10.66 9.88 16.92 16.08s17.09 3.47 23.08-3.08z"/></g></svg>';
		const svgBoss = '<svg width="20" height="20" viewBox="0 0 40 41" xmlns="http://www.w3.org/2000/svg" style="fill: #fff;"><g><path d="m21 12c-2.19-3.23 5.54-10.95-0.97-10.97-6.52-0.02 1.07 7.75-1.03 10.97-2.81 0.28-5.49-0.2-8-1-0.68 3.53 0.55 6.06 4 4 0.65 7.03 1.11 10.95 1.67 18.33 0.57 7.38 6.13 7.2 6.55-0.11 0.42-7.3 1.35-11.22 1.78-18.22 3.53 1.9 4.73-0.42 4-4-2.61 0.73-5.14 1.35-8 1m-1 17c-1.59-3.6-1.71-10.47 0-14 1.59 3.6 1.71 10.47 0 14z"/></g><g><path d="m6 19c-1.24-4.15 2.69-8.87 1-12-3.67 4.93-6.52 10.57-6 17 5.64-0.15 8.82 4.98 13 8 1.3-6.54-0.67-12.84-8-13z"/></g><g><path d="m33 7c0.38 5.57 2.86 14.79-7 15v10c4.13-2.88 7.55-7.97 13-8 0.48-6.46-2.29-12.06-6-17z"/></g></svg>';
		const svgAttempt = '<svg width="20" height="20" viewBox="0 0 645 645" xmlns="http://www.w3.org/2000/svg" style="fill: #fff;"><g><path d="m442 26c-8.8 5.43-6.6 21.6-12.01 30.99-2.5 11.49-5.75 22.74-8.99 34.01-40.61-17.87-92.26-15.55-133.32-0.32-72.48 27.31-121.88 100.19-142.68 171.32 10.95-4.49 19.28-14.97 29.3-21.7 50.76-37.03 121.21-79.04 183.47-44.07 16.68 5.8 2.57 21.22-0.84 31.7-4.14 12.19-11.44 23.41-13.93 36.07 56.01-17.98 110.53-41.23 166-61-20.49-59.54-46.13-117.58-67-177z"/></g><g><path d="m563 547c23.89-16.34 36.1-45.65 47.68-71.32 23.57-62.18 7.55-133.48-28.38-186.98-15.1-22.67-31.75-47.63-54.3-63.7 1.15 14.03 6.71 26.8 8.22 40.78 12.08 61.99 15.82 148.76-48.15 183.29-10.46-0.54-15.99-16.1-24.32-22.82-8.2-7.58-14.24-19.47-23.75-24.25-4.88 59.04-11.18 117.71-15 177 62.9 5.42 126.11 9.6 189 15-4.84-9.83-17.31-15.4-24.77-24.23-9.02-7.06-17.8-15.13-26.23-22.77z"/></g><g><path d="m276 412c-10.69-15.84-30.13-25.9-43.77-40.23-15.39-12.46-30.17-25.94-45.48-38.52-15.82-11.86-29.44-28.88-46.75-37.25-19.07 24.63-39.96 48.68-60.25 72.75-18.71 24.89-42.41 47.33-58.75 73.25 22.4-2.87 44.99-13.6 66.67-13.67 0.06 22.8 10.69 42.82 20.41 62.59 49.09 93.66 166.6 114.55 261.92 96.08-6.07-9.2-22.11-9.75-31.92-16.08-59.45-26.79-138.88-75.54-127.08-151.92 21.66-2.39 43.42-4.37 65-7z"/></g></svg>';

		this.start = function (battleArgs, battleInfo) {
			battleArg = battleArgs;
			if (nameFuncStartBattle == 'invasion_bossStart') {
				startBattle();
				return;
			}
			preCalcBattle(battleInfo);
		}
		/**
		 * Returns a promise for combat recalculation
		 *
		 * Возвращает промис для прерасчета боя
		 */
		function getBattleInfo(battle) {
			return new Promise(function (resolve) {
				battle.seed = Math.floor(Date.now() / 1000) + random(0, 1e3);
				Calc(battle).then(e => {
					e.coeff = calcCoeff(e, 'defenders');
					resolve(e);
				});
			});
		}
		/**
		 * Battle recalculation
		 *
		 * Прерасчет боя
		 */
		function preCalcBattle(battle) {
			let actions = [];
			const countTestBattle = getInput('countTestBattle');
			for (let i = 0; i < countTestBattle; i++) {
				actions.push(getBattleInfo(battle));
			}
			Promise.all(actions)
				.then(resultPreCalcBattle);
		}
		/**
		 * Processing the results of the battle recalculation
		 *
		 * Обработка результатов прерасчета боя
		 */
		async function resultPreCalcBattle(results) {
			let countWin = results.reduce((s, w) => w.result.win + s, 0);
			setProgress(`${I18N('CHANCE_TO_WIN')} ${Math.floor(countWin / results.length * 100)}% (${results.length})`, false, hideProgress);
			if (countWin > 0) {
				setIsCancalBattle(false);
				startBattle();
				return;
			}

			let minCoeff = 100;
			let maxCoeff = -100;
			let avgCoeff = 0;
			results.forEach(e => {
				if (e.coeff < minCoeff) minCoeff = e.coeff;
				if (e.coeff > maxCoeff) maxCoeff = e.coeff;
				avgCoeff += e.coeff;
			});
			avgCoeff /= results.length;

			if (nameFuncStartBattle == 'invasion_bossStart' ||
				nameFuncStartBattle == 'bossAttack') {
				const result = await popup.confirm(
					I18N('BOSS_VICTORY_IMPOSSIBLE', { battles: results.length }), [
					{ msg: I18N('BTN_CANCEL'), result: false, isCancel: true },
					{ msg: I18N('BTN_DO_IT'), result: true },
				])
				if (result) {
					setIsCancalBattle(false);
					startBattle();
					return;
				}
				setProgress(I18N('NOT_THIS_TIME'), true);
				endAutoBattle('invasion_bossStart');
				return;
			}

			const result = await popup.confirm(
				I18N('VICTORY_IMPOSSIBLE') +
				`<br>${I18N('ROUND_STAT')} ${results.length} ${I18N('BATTLE')}:` +
				`<br>${I18N('MINIMUM')}: ` + minCoeff.toLocaleString() +
				`<br>${I18N('MAXIMUM')}: ` + maxCoeff.toLocaleString() +
				`<br>${I18N('AVERAGE')}: ` + avgCoeff.toLocaleString() +
				`<br>${I18N('FIND_COEFF')} ` + avgCoeff.toLocaleString(), [
				{ msg: I18N('BTN_CANCEL'), result: 0, isCancel: true },
				{ msg: I18N('BTN_GO'), isInput: true, default: Math.round(avgCoeff * 1000) / 1000 },
			])
			if (result) {
				findCoeff = result;
				setIsCancalBattle(false);
				startBattle();
				return;
			}
			setProgress(I18N('NOT_THIS_TIME'), true);
			endAutoBattle(I18N('NOT_THIS_TIME'));
		}

		/**
		 * Calculation of the combat result coefficient
		 *
		 * Расчет коэфициента результата боя
		 */
		function calcCoeff(result, packType) {
			let beforeSumFactor = 0;
			const beforePack = result.battleData[packType][0];
			for (let heroId in beforePack) {
				const hero = beforePack[heroId];
				const state = hero.state;
				let factor = 1;
				if (state) {
					const hp = state.hp / state.maxHp;
					const energy = state.energy / 1e3;
					factor = hp + energy / 20;
				}
				beforeSumFactor += factor;
			}

			let afterSumFactor = 0;
			const afterPack = result.progress[0][packType].heroes;
			for (let heroId in afterPack) {
				const hero = afterPack[heroId];
				const stateHp = beforePack[heroId]?.state?.hp || beforePack[heroId]?.stats?.hp;
				const hp = hero.hp / stateHp;
				const energy = hero.energy / 1e3;
				const factor = hp + energy / 20;
				afterSumFactor += factor;
			}
			const resultCoeff = -(afterSumFactor - beforeSumFactor);
			return Math.round(resultCoeff * 1000) / 1000;
		}
		/**
		 * Start battle
		 *
		 * Начало боя
		 */
		function startBattle() {
			countBattle++;
			const countMaxBattle = getInput('countAutoBattle');
			// setProgress(countBattle + '/' + countMaxBattle);
			if (countBattle > countMaxBattle) {
				setProgress(`${I18N('RETRY_LIMIT_EXCEEDED')}: ${countMaxBattle}`, true);
				endAutoBattle(`${I18N('RETRY_LIMIT_EXCEEDED')}: ${countMaxBattle}`)
				return;
			}
			if (stopAutoBattle) {
				setProgress(I18N('STOPPED'), true);
				endAutoBattle('STOPPED');
				return;
			}
			send({calls: [{
				name: nameFuncStartBattle,
				args: battleArg,
				ident: "body"
			}]}, calcResultBattle);
		}
		/**
		 * Battle calculation
		 *
		 * Расчет боя
		 */
		async function calcResultBattle(e) {
			if (!e) {
				console.log('данные не были получены');
				if (dataNotEeceived < 10) {
					dataNotEeceived++;
					startBattle();
					return;
				}
				endAutoBattle('Error', 'данные не были получены ' + dataNotEeceived + ' раз');
				return;
			}
			if ('error' in e) {
				if (e.error.description === 'too many tries') {
					invasionTimer += 100;
					countBattle--;
					countError++;
					console.log(`Errors: ${countError}`, e.error);
					startBattle();
					return;
				}
				const result = await popup.confirm(I18N('ERROR_DURING_THE_BATTLE') + '<br>' + e.error.description, [
					{ msg: I18N('BTN_OK'), result: false },
					{ msg: I18N('RELOAD_GAME'), result: true },
				]);
				endAutoBattle('Error', e.error);
				if (result) {
					location.reload();
				}
				return;
			}
			let battle = e.results[0].result.response.battle
			if (nameFuncStartBattle == 'towerStartBattle' ||
				nameFuncStartBattle == 'bossAttack' ||
				nameFuncStartBattle == 'invasion_bossStart') {
				battle = e.results[0].result.response;
			}
			lastBattleInfo = battle;
			BattleCalc(battle, getBattleType(battle.type), resultBattle);
		}
		/**
		 * Processing the results of the battle
		 *
		 * Обработка результатов боя
		 */
		async function resultBattle(e) {
			const isWin = e.result.win;
			if (isWin) {
				endBattle(e, false);
				return;
			} else if (isChecked('tryFixIt_v2')) {
				const { WinFixBattle } = HWHClasses;
				const cloneBattle = structuredClone(e.battleData);
				const bFix = new WinFixBattle(cloneBattle);
				let attempts = Infinity;
				if (nameFuncStartBattle == 'invasion_bossStart' && !isSetWinTimer) {
					const { invasionInfo, invasionDataPacks } = HWHData;


					let timer = '0';
					const pack = invasionDataPacks[invasionInfo.bossLvl];
					if (pack && pack.timer && (pack.buff == invasionInfo.buff)) {
						timer = pack.timer;
					}

					let winTimer = await popup.confirm(`Secret number:`, [
						{ result: false, isClose: true },
						{ msg: 'Go', isInput: true, default: timer },
					]);
					winTimer = Number.parseFloat(winTimer);
					if (winTimer) {
						attempts = 5;
						bFix.setWinTimer(winTimer);
					}
					isSetWinTimer = true;
				}
				let endTime = Date.now() + 6e4;
				if (nameFuncStartBattle == 'invasion_bossStart') {
					endTime = Date.now() + 6e4 * 4;
					bFix.isGetTimer = false;
					bFix.setMaxTimer(120.3);
				}
				const result = await bFix.start(endTime, attempts);
				console.log(result);
				if (result.result?.win) {
					endBattle(result, false);
					return;
				}
			}
			const countMaxBattle = getInput('countAutoBattle');
			if (findCoeff) {
				const coeff = calcCoeff(e, 'defenders');
				setProgress(`${countBattle}/${countMaxBattle}, ${coeff}`);
				if (coeff > findCoeff) {
					endBattle(e, false);
					return;
				}
			} else {
				if (nameFuncStartBattle == 'invasion_bossStart') {
					const bossLvl = lastBattleInfo.typeId >= 130 ? lastBattleInfo.typeId : '';
					const justice = lastBattleInfo?.effects?.attackers?.percentInOutDamageModAndEnergyIncrease_any_99_100_300_99_1000_30 || 0;
					setProgress(`${svgBoss} ${bossLvl} ${svgJustice} ${justice} <br>${svgAttempt} ${countBattle}/${countMaxBattle}`, false, () => {
						stopAutoBattle = true;
					});
					await new Promise((resolve) => setTimeout(resolve, 5000));
				} else {
					setProgress(`${countBattle}/${countMaxBattle}`);
				}
			}
			if (nameFuncStartBattle == 'towerStartBattle' ||
				nameFuncStartBattle == 'bossAttack' ||
				nameFuncStartBattle == 'invasion_bossStart') {
				startBattle();
				return;
			}
			cancelEndBattle(e);
		}
		/**
		 * Cancel fight
		 *
		 * Отмена боя
		 */
		function cancelEndBattle(r) {
			const fixBattle = function (heroes) {
				for (const ids in heroes) {
					hero = heroes[ids];
					hero.energy = random(1, 999);
					if (hero.hp > 0) {
						hero.hp = random(1, hero.hp);
					}
				}
			}
			fixBattle(r.progress[0].attackers.heroes);
			fixBattle(r.progress[0].defenders.heroes);
			endBattle(r, true);
		}
		/**
		 * End of the fight
		 *
		 * Завершение боя */
		function endBattle(battleResult, isCancal) {
			let calls = [{
				name: nameFuncEndBattle,
				args: {
					result: battleResult.result,
					progress: battleResult.progress
				},
				ident: "body"
			}];

			if (nameFuncStartBattle == 'invasion_bossStart') {
				calls[0].args.id = lastBattleArg.id;
			}

			send(JSON.stringify({
				calls
			}), async e => {
				console.log(e);
				if (isCancal) {
					startBattle();
					return;
				}

				setProgress(`${I18N('SUCCESS')}!`, 5000)
				if (nameFuncStartBattle == 'invasion_bossStart' ||
					nameFuncStartBattle == 'bossAttack') {
					const countMaxBattle = getInput('countAutoBattle');
					const bossLvl = lastBattleInfo.typeId >= 130 ? lastBattleInfo.typeId : '';
					const justice = lastBattleInfo?.effects?.attackers?.percentInOutDamageModAndEnergyIncrease_any_99_100_300_99_1000_30 || 0;
					let winTimer = '';
					if (nameFuncStartBattle == 'invasion_bossStart') {
						const timer = battleResult.progress[0].attackers.input[5];
						winTimer += '<br>Secret number: ' + timer;
						winTimer +=
							'<br>' +
							battleArg.heroes
								.map((id) => `${cheats.translate('LIB_HERO_NAME_' + id)}(${cheats.translate('LIB_HERO_NAME_' + battleArg.favor[id])})`)
								.join(' ') +
							' ' +
							(battleArg.pet ? cheats.translate('LIB_HERO_NAME_' + battleArg.pet) : '');
						console.log(bossLvl, {
							buff: justice,
							pet: battleArg.pet,
							heroes: battleArg.heroes,
							favor: battleArg.favor,
							timer,
						});
					}
					const result = await popup.confirm(
						I18N('BOSS_HAS_BEEN_DEF_TEXT', {
							bossLvl: `${svgBoss} ${bossLvl} ${svgJustice} ${justice}`,
							countBattle: svgAttempt + ' ' + countBattle,
							countMaxBattle,
							winTimer,
						}),
						[
							{ msg: I18N('BTN_OK'), result: 0 },
							{ msg: I18N('MAKE_A_SYNC'), result: 1 },
							{ msg: I18N('RELOAD_GAME'), result: 2 },
						]
					);
					if (result) {
						if (result == 1) {
							cheats.refreshGame();
						}
						if (result == 2) {
							location.reload();
						}
					}

				}
				endAutoBattle(`${I18N('SUCCESS')}!`)
			});
		}
		/**
		 * Completing a task
		 *
		 * Завершение задачи
		 */
		function endAutoBattle(reason, info) {
			setIsCancalBattle(true);
			console.log(reason, info);
			resolve();
		}
	}

	this.HWHClasses.executeAutoBattle = executeAutoBattle;

	function testDailyQuests() {
		const { dailyQuests } = HWHClasses;
		return new Promise(async (resolve, reject) => {
			const quests = new dailyQuests(resolve, reject);
			await quests.autoInit(true);
			quests.start();
		});
	}

	/**
	 * Automatic completion of daily quests
	 *
	 * Автоматическое выполнение ежедневных квестов
	 */
	class dailyQuests {
		/**
		 * Send(' {"calls":[{"name":"userGetInfo","args":{},"ident":"body"}]}').then(e => console.log(e))
		 * Send(' {"calls":[{"name":"heroGetAll","args":{},"ident":"body"}]}').then(e => console.log(e))
		 * Send(' {"calls":[{"name":"titanGetAll","args":{},"ident":"body"}]}').then(e => console.log(e))
		 * Send(' {"calls":[{"name":"inventoryGet","args":{},"ident":"body"}]}').then(e => console.log(e))
		 * Send(' {"calls":[{"name":"questGetAll","args":{},"ident":"body"}]}').then(e => console.log(e))
		 * Send(' {"calls":[{"name":"bossGetAll","args":{},"ident":"body"}]}').then(e => console.log(e))
		 */
		callsList = ['userGetInfo', 'heroGetAll', 'titanGetAll', 'inventoryGet', 'questGetAll', 'bossGetAll', 'missionGetAll'];

		dataQuests = {
			10001: {
				description: 'Улучши умения героев 3 раза', // ++++++++++++++++
				doItCall: () => {
					const upgradeSkills = this.getUpgradeSkills();
					return upgradeSkills.map(({ heroId, skill }, index) => ({
						name: 'heroUpgradeSkill',
						args: { heroId, skill },
						ident: `heroUpgradeSkill_${index}`,
					}));
				},
				isWeCanDo: () => {
					const upgradeSkills = this.getUpgradeSkills();
					let sumGold = 0;
					for (const skill of upgradeSkills) {
						sumGold += this.skillCost(skill.value);
						if (!skill.heroId) {
							return false;
						}
					}
					return this.questInfo['userGetInfo'].gold > sumGold;
				},
			},
			10002: {
				description: 'Пройди 10 миссий', // --------------
				isWeCanDo: () => false,
			},
			10003: {
				description: 'Пройди 3 героические миссии', // ++++++++++++++++
				isWeCanDo: () => {
					const vipPoints = +this.questInfo.userGetInfo.vipPoints;
					const goldTicket = !!this.questInfo.inventoryGet.consumable[151];
					return (vipPoints > 100 || goldTicket) && this.getHeroicMissionId();
				},
				doItCall: () => {
					const selectedMissionId = this.getHeroicMissionId();
					const goldTicket = !!this.questInfo.inventoryGet.consumable[151];
					const vipLevel = Math.max(...lib.data.level.vip.filter(l => l.vipPoints <= +this.questInfo.userGetInfo.vipPoints).map(l => l.level));
					// Возвращаем массив команд для рейда
					if (vipLevel >= 5 || goldTicket) {
						return [{ name: 'missionRaid', args: { id: selectedMissionId, times: 3 }, ident: 'missionRaid_1' }];
					} else {
						return [
							{ name: 'missionRaid', args: { id: selectedMissionId, times: 1 }, ident: 'missionRaid_1' },
							{ name: 'missionRaid', args: { id: selectedMissionId, times: 1 }, ident: 'missionRaid_2' },
							{ name: 'missionRaid', args: { id: selectedMissionId, times: 1 }, ident: 'missionRaid_3' },
						];
					}
				},
			},
			10004: {
				description: 'Сразись 3 раза на Арене или Гранд Арене', // --------------
				isWeCanDo: () => false,
			},
			10006: {
				description: 'Используй обмен изумрудов 1 раз', // ++++++++++++++++
				doItCall: () => [
					{
						name: 'refillableAlchemyUse',
						args: { multi: false },
						ident: 'refillableAlchemyUse',
					},
				],
				isWeCanDo: () => {
					const starMoney = this.questInfo['userGetInfo'].starMoney;
					return starMoney >= 20;
				},
			},
			10007: {
				description: 'Соверши 1 призыв в Атриуме Душ', // ++++++++++++++++
				doItCall: () => [{ name: 'gacha_open', args: { ident: 'heroGacha', free: true, pack: false }, ident: 'gacha_open' }],
				isWeCanDo: () => {
					const soulCrystal = this.questInfo['inventoryGet'].coin[38];
					return soulCrystal > 0;
				},
			},
			10016: {
				description: 'Отправь подарки согильдийцам', // ++++++++++++++++
				doItCall: () => [{ name: 'clanSendDailyGifts', args: {}, ident: 'clanSendDailyGifts' }],
				isWeCanDo: () => true,
			},
			10018: {
				description: 'Используй зелье опыта', // ++++++++++++++++
				doItCall: () => {
					const expHero = this.getExpHero();
					return [
						{
							name: 'consumableUseHeroXp',
							args: {
								heroId: expHero.heroId,
								libId: expHero.libId,
								amount: 1,
							},
							ident: 'consumableUseHeroXp',
						},
					];
				},
				isWeCanDo: () => {
					const expHero = this.getExpHero();
					return expHero.heroId && expHero.libId;
				},
			},
			10019: {
				description: 'Открой 1 сундук в Башне',
				doItFunc: testTower,
				isWeCanDo: () => false,
			},
			10020: {
				description: 'Открой 3 сундука в Запределье', // Готово
				doItCall: () => {
					return this.getOutlandChest();
				},
				isWeCanDo: () => {
					const outlandChest = this.getOutlandChest();
					return outlandChest.length > 0;
				},
			},
			10021: {
				description: 'Собери 75 Титанита в Подземелье Гильдии',
				isWeCanDo: () => false,
			},
			10022: {
				description: 'Собери 150 Титанита в Подземелье Гильдии',
				doItFunc: testDungeon,
				isWeCanDo: () => false,
			},
			10023: {
				description: 'Прокачай Дар Стихий на 1 уровень', // Готово
				doItCall: () => {
					const heroId = this.getHeroIdTitanGift();
					return [
						{ name: 'heroTitanGiftLevelUp', args: { heroId }, ident: 'heroTitanGiftLevelUp' },
						{ name: 'heroTitanGiftDrop', args: { heroId }, ident: 'heroTitanGiftDrop' },
					];
				},
				isWeCanDo: () => {
					const heroId = this.getHeroIdTitanGift();
					return heroId;
				},
			},
			10024: {
				description: 'Повысь уровень любого артефакта один раз', // Готово
				doItCall: () => {
					const upArtifact = this.getUpgradeArtifact();
					return [
						{
							name: 'heroArtifactLevelUp',
							args: {
								heroId: upArtifact.heroId,
								slotId: upArtifact.slotId,
							},
							ident: `heroArtifactLevelUp`,
						},
					];
				},
				isWeCanDo: () => {
					const upgradeArtifact = this.getUpgradeArtifact();
					return upgradeArtifact.heroId;
				},
			},
			10025: {
				description: 'Начни 1 Экспедицию',
				doItFunc: checkExpedition,
				isWeCanDo: () => false,
			},
			10026: {
				description: 'Начни 4 Экспедиции', // --------------
				doItFunc: checkExpedition,
				isWeCanDo: () => false,
			},
			10027: {
				description: 'Победи в 1 бою Турнира Стихий',
				doItFunc: testTitanArena,
				isWeCanDo: () => false,
			},
			10028: {
				description: 'Повысь уровень любого артефакта титанов', // Готово
				doItCall: () => {
					const upTitanArtifact = this.getUpgradeTitanArtifact();
					return [
						{
							name: 'titanArtifactLevelUp',
							args: {
								titanId: upTitanArtifact.titanId,
								slotId: upTitanArtifact.slotId,
							},
							ident: `titanArtifactLevelUp`,
						},
					];
				},
				isWeCanDo: () => {
					const upgradeTitanArtifact = this.getUpgradeTitanArtifact();
					return upgradeTitanArtifact.titanId;
				},
			},
			10029: {
				description: 'Открой сферу артефактов титанов', // ++++++++++++++++
				doItCall: () => [{ name: 'titanArtifactChestOpen', args: { amount: 1, free: true }, ident: 'titanArtifactChestOpen' }],
				isWeCanDo: () => {
					return this.questInfo['inventoryGet']?.consumable[55] > 0;
				},
			},
			10030: {
				description: 'Улучши облик любого героя 1 раз', // Готово
				doItCall: () => {
					const upSkin = this.getUpgradeSkin();
					return [
						{
							name: 'heroSkinUpgrade',
							args: {
								heroId: upSkin.heroId,
								skinId: upSkin.skinId,
							},
							ident: `heroSkinUpgrade`,
						},
					];
				},
				isWeCanDo: () => {
					const upgradeSkin = this.getUpgradeSkin();
					return upgradeSkin.heroId;
				},
			},
			10031: {
				description: 'Победи в 6 боях Турнира Стихий', // --------------
				doItFunc: testTitanArena,
				isWeCanDo: () => false,
			},
			10043: {
				description: 'Начни или присоеденись к Приключению', // --------------
				isWeCanDo: () => false,
			},
			10044: {
				description: 'Воспользуйся призывом питомцев 1 раз', // ++++++++++++++++
				doItCall: () => [{ name: 'pet_chestOpen', args: { amount: 1, paid: false }, ident: 'pet_chestOpen' }],
				isWeCanDo: () => {
					return this.questInfo['inventoryGet']?.consumable[90] > 0;
				},
			},
			10046: {
				/**
				 * TODO: Watch Adventure
				 * TODO: Смотреть приключение
				 */
				description: 'Открой 3 сундука в Приключениях',
				isWeCanDo: () => false,
			},
			10047: {
				description: 'Набери 150 очков активности в Гильдии', // Готово
				doItCall: () => {
					const enchantRune = this.getEnchantRune();
					return [
						{
							name: 'heroEnchantRune',
							args: {
								heroId: enchantRune.heroId,
								tier: enchantRune.tier,
								items: {
									consumable: { [enchantRune.itemId]: 1 },
								},
							},
							ident: `heroEnchantRune`,
						},
					];
				},
				isWeCanDo: () => {
					const userInfo = this.questInfo['userGetInfo'];
					const enchantRune = this.getEnchantRune();
					return enchantRune.heroId && userInfo.gold > 1e3;
				},
			},
		};

		constructor(resolve, reject, questInfo) {
			this.resolve = resolve;
			this.reject = reject;
		}

		init(questInfo) {
			this.questInfo = questInfo;
			this.isAuto = true;
		}

		async autoInit(isAuto) {
			this.isAuto = isAuto || false;
			const quests = {};
			const calls = this.callsList.map((name) => ({
				name,
				args: {},
				ident: name,
			}));
			const result = await Send(JSON.stringify({ calls })).then((e) => e.results);
			for (const call of result) {
				quests[call.ident] = call.result.response;
			}
			this.questInfo = quests;
		}

		async start() {
			const weCanDo = [];
			const selectedActions = getSaveVal('selectedActions', {});
			for (let quest of this.questInfo['questGetAll']) {
				if (quest.id in this.dataQuests && quest.state == 1) {
					if (!selectedActions[quest.id]) {
						selectedActions[quest.id] = {
							checked: false,
						};
					}

					const isWeCanDo = this.dataQuests[quest.id].isWeCanDo;
					if (!isWeCanDo.call(this)) {
						continue;
					}

					weCanDo.push({
						name: quest.id,
						label: I18N(`QUEST_${quest.id}`),
						checked: selectedActions[quest.id].checked,
					});
				}
			}

			if (!weCanDo.length) {
				this.end(I18N('NOTHING_TO_DO'));
				return;
			}

			console.log(weCanDo);
			let taskList = [];
			if (this.isAuto) {
				taskList = weCanDo;
				// Auto mode: check all tasks and update selectedActions
				taskList.forEach((e) => {
					selectedActions[e.name].checked = true;
				});
				setSaveVal('selectedActions', selectedActions);
			} else {
				const answer = await popup.confirm(
					`${I18N('YOU_CAN_COMPLETE')}:`,
					[
						{ msg: I18N('BTN_DO_IT'), result: true },
						{ msg: I18N('BTN_CANCEL'), result: false, isCancel: true },
					],
					weCanDo
				);
				if (!answer) {
					this.end('');
					return;
				}
				taskList = popup.getCheckBoxes();
				taskList.forEach((e) => {
					selectedActions[e.name].checked = e.checked;
				});
				setSaveVal('selectedActions', selectedActions);
			}

			const calls = [];
			let countChecked = 0;
			for (const task of taskList) {
				if (task.checked) {
					countChecked++;
					const quest = this.dataQuests[task.name];
					console.log(quest.description);

					if (quest.doItCall) {
						const doItCall = quest.doItCall.call(this);
						calls.push(...doItCall);
					}
				}
			}

			if (!countChecked) {
				this.end(I18N('NOT_QUEST_COMPLETED'));
				return;
			}

			const result = await Send(JSON.stringify({ calls }));
			if (result.error) {
				console.error(result.error, result.error.call);
			}
			this.end(`${I18N('COMPLETED_QUESTS')}: ${countChecked}`);
		}

		errorHandling(error) {
			//console.error(error);
			let errorInfo = error.toString() + '\n';
			try {
				const errorStack = error.stack.split('\n');
				const endStack = errorStack.map((e) => e.split('@')[0]).indexOf('testDoYourBest');
				errorInfo += errorStack.slice(0, endStack).join('\n');
			} catch (e) {
				errorInfo += error.stack;
			}
			copyText(errorInfo);
		}

		skillCost(lvl) {
			return 573 * lvl ** 0.9 + lvl ** 2.379;
		}

		getUpgradeSkills() {
			const heroes = Object.values(this.questInfo['heroGetAll']);
			const upgradeSkills = [
				{ heroId: 0, slotId: 0, value: 130 },
				{ heroId: 0, slotId: 0, value: 130 },
				{ heroId: 0, slotId: 0, value: 130 },
			];
			const skillLib = lib.getData('skill');
			/**
			 * color - 1 (белый) открывает 1 навык
			 * color - 2 (зеленый) открывает 2 навык
			 * color - 4 (синий) открывает 3 навык
			 * color - 7 (фиолетовый) открывает 4 навык
			 */
			const colors = [1, 2, 4, 7];
			for (const hero of heroes) {
				const level = hero.level;
				const color = hero.color;
				for (let skillId in hero.skills) {
					const tier = skillLib[skillId].tier;
					const sVal = hero.skills[skillId];
					if (color < colors[tier] || tier < 1 || tier > 4) {
						continue;
					}
					for (let upSkill of upgradeSkills) {
						if (sVal < upSkill.value && sVal < level) {
							upSkill.value = sVal;
							upSkill.heroId = hero.id;
							upSkill.skill = tier;
							break;
						}
					}
				}
			}
			return upgradeSkills;
		}

		getUpgradeArtifact() {
			const heroes = Object.values(this.questInfo['heroGetAll']);
			const inventory = this.questInfo['inventoryGet'];
			const upArt = { heroId: 0, slotId: 0, level: 100 };

			const heroLib = lib.getData('hero');
			const artifactLib = lib.getData('artifact');

			for (const hero of heroes) {
				const heroInfo = heroLib[hero.id];
				const level = hero.level;
				if (level < 20) {
					continue;
				}

				for (let slotId in hero.artifacts) {
					const art = hero.artifacts[slotId];
					/* Текущая звезданость арта */
					const star = art.star;
					if (!star) {
						continue;
					}
					/* Текущий уровень арта */
					const level = art.level;
					if (level >= 100) {
						continue;
					}
					/* Идентификатор арта в библиотеке */
					const artifactId = heroInfo.artifacts[slotId];
					const artInfo = artifactLib.id[artifactId];
					const costNextLevel = artifactLib.type[artInfo.type].levels[level + 1].cost;

					const costCurrency = Object.keys(costNextLevel).pop();
					const costValues = Object.entries(costNextLevel[costCurrency]).pop();
					const costId = costValues[0];
					const costValue = +costValues[1];

					/** TODO: Возможно стоит искать самый высокий уровень который можно качнуть? */
					if (level < upArt.level && inventory[costCurrency][costId] >= costValue) {
						upArt.level = level;
						upArt.heroId = hero.id;
						upArt.slotId = slotId;
						upArt.costCurrency = costCurrency;
						upArt.costId = costId;
						upArt.costValue = costValue;
					}
				}
			}
			return upArt;
		}

		getUpgradeSkin() {
			const heroes = Object.values(this.questInfo['heroGetAll']);
			const inventory = this.questInfo['inventoryGet'];
			const upSkin = { heroId: 0, skinId: 0, level: 60, cost: 1500 };

			const skinLib = lib.getData('skin');

			for (const hero of heroes) {
				const level = hero.level;
				if (level < 20) {
					continue;
				}

				for (let skinId in hero.skins) {
					/* Текущий уровень скина */
					const level = hero.skins[skinId];
					if (level >= 60) {
						continue;
					}
					/* Идентификатор скина в библиотеке */
					const skinInfo = skinLib[skinId];
					if (!skinInfo.statData.levels?.[level + 1]) {
						continue;
					}
					const costNextLevel = skinInfo.statData.levels[level + 1].cost;

					const costCurrency = Object.keys(costNextLevel).pop();
					const costCurrencyId = Object.keys(costNextLevel[costCurrency]).pop();
					const costValue = +costNextLevel[costCurrency][costCurrencyId];

					/** TODO: Возможно стоит искать самый высокий уровень который можно качнуть? */
					if (level < upSkin.level && costValue < upSkin.cost && inventory[costCurrency][costCurrencyId] >= costValue) {
						upSkin.cost = costValue;
						upSkin.level = level;
						upSkin.heroId = hero.id;
						upSkin.skinId = skinId;
						upSkin.costCurrency = costCurrency;
						upSkin.costCurrencyId = costCurrencyId;
					}
				}
			}
			return upSkin;
		}

		getUpgradeTitanArtifact() {
			const titans = Object.values(this.questInfo['titanGetAll']);
			const inventory = this.questInfo['inventoryGet'];
			const userInfo = this.questInfo['userGetInfo'];
			const upArt = { titanId: 0, slotId: 0, level: 120 };

			const titanLib = lib.getData('titan');
			const artTitanLib = lib.getData('titanArtifact');

			for (const titan of titans) {
				const titanInfo = titanLib[titan.id];
				// const level = titan.level
				// if (level < 20) {
				// 	continue;
				// }

				for (let slotId in titan.artifacts) {
					const art = titan.artifacts[slotId];
					/* Текущая звезданость арта */
					const star = art.star;
					if (!star) {
						continue;
					}
					/* Текущий уровень арта */
					const level = art.level;
					if (level >= 120) {
						continue;
					}
					/* Идентификатор арта в библиотеке */
					const artifactId = titanInfo.artifacts[slotId];
					const artInfo = artTitanLib.id[artifactId];
					const costNextLevel = artTitanLib.type[artInfo.type].levels[level + 1].cost;

					const costCurrency = Object.keys(costNextLevel).pop();
					let costValue = 0;
					let currentValue = 0;
					if (costCurrency == 'gold') {
						costValue = costNextLevel[costCurrency];
						currentValue = userInfo.gold;
					} else {
						const costValues = Object.entries(costNextLevel[costCurrency]).pop();
						const costId = costValues[0];
						costValue = +costValues[1];
						currentValue = inventory[costCurrency][costId];
					}

					/** TODO: Возможно стоит искать самый высокий уровень который можно качнуть? */
					if (level < upArt.level && currentValue >= costValue) {
						upArt.level = level;
						upArt.titanId = titan.id;
						upArt.slotId = slotId;
						break;
					}
				}
			}
			return upArt;
		}

		getEnchantRune() {
			const heroes = Object.values(this.questInfo['heroGetAll']);
			const inventory = this.questInfo['inventoryGet'];
			const enchRune = { heroId: 0, tier: 0, exp: 43750, itemId: 0 };
			for (let i = 1; i <= 4; i++) {
				if (inventory.consumable[i] > 0) {
					enchRune.itemId = i;
					break;
				}
				return enchRune;
			}

			const runeLib = lib.getData('rune');
			const runeLvls = Object.values(runeLib.level);
			/**
			 * color - 4 (синий) открывает 1 и 2 символ
			 * color - 7 (фиолетовый) открывает 3 символ
			 * color - 8 (фиолетовый +1) открывает 4 символ
			 * color - 9 (фиолетовый +2) открывает 5 символ
			 */
			// TODO: кажется надо учесть уровень команды
			const colors = [4, 4, 7, 8, 9];
			for (const hero of heroes) {
				const color = hero.color;

				for (let runeTier in hero.runes) {
					/* Проверка на доступность руны */
					if (color < colors[runeTier]) {
						continue;
					}
					/* Текущий опыт руны */
					const exp = hero.runes[runeTier];
					if (exp >= 43750) {
						continue;
					}

					let level = 0;
					if (exp) {
						for (let lvl of runeLvls) {
							if (exp >= lvl.enchantValue) {
								level = lvl.level;
							} else {
								break;
							}
						}
					}
					/** Уровень героя необходимый для уровня руны */
					const heroLevel = runeLib.level[level].heroLevel;
					if (hero.level < heroLevel) {
						continue;
					}

					/** TODO: Возможно стоит искать самый высокий уровень который можно качнуть? */
					if (exp < enchRune.exp) {
						enchRune.exp = exp;
						enchRune.heroId = hero.id;
						enchRune.tier = runeTier;
						break;
					}
				}
			}
			return enchRune;
		}

		getOutlandChest() {
			const bosses = this.questInfo['bossGetAll'];

			const calls = [];

			for (let boss of bosses) {
				if (boss.mayRaid) {
					calls.push({
						name: 'bossRaid',
						args: {
							bossId: boss.id,
						},
						ident: 'bossRaid_' + boss.id,
					});
					calls.push({
						name: 'bossOpenChest',
						args: {
							bossId: boss.id,
							amount: 1,
							starmoney: 0,
						},
						ident: 'bossOpenChest_' + boss.id,
					});
				} else if (boss.chestId == 1) {
					calls.push({
						name: 'bossOpenChest',
						args: {
							bossId: boss.id,
							amount: 1,
							starmoney: 0,
						},
						ident: 'bossOpenChest_' + boss.id,
					});
				}
			}

			return calls;
		}

		getExpHero() {
			const heroes = Object.values(this.questInfo['heroGetAll']);
			const inventory = this.questInfo['inventoryGet'];
			const expHero = { heroId: 0, exp: 3625195, libId: 0 };
			/** зелья опыта (consumable 9, 10, 11, 12) */
			for (let i = 9; i <= 12; i++) {
				if (inventory.consumable[i]) {
					expHero.libId = i;
					break;
				}
			}

			for (const hero of heroes) {
				const exp = hero.xp;
				if (exp < expHero.exp) {
					expHero.heroId = hero.id;
				}
			}
			return expHero;
		}

		getHeroIdTitanGift() {
			const heroes = Object.values(this.questInfo['heroGetAll']);
			const inventory = this.questInfo['inventoryGet'];
			const user = this.questInfo['userGetInfo'];
			const titanGiftLib = lib.getData('titanGift');
			/** Искры */
			const titanGift = inventory.consumable[24];
			let heroId = 0;
			let minLevel = 30;

			if (titanGift < 250 || user.gold < 7000) {
				return 0;
			}

			for (const hero of heroes) {
				if (hero.titanGiftLevel >= 30) {
					continue;
				}

				if (!hero.titanGiftLevel) {
					return hero.id;
				}

				const cost = titanGiftLib[hero.titanGiftLevel].cost;
				if (minLevel > hero.titanGiftLevel && titanGift >= cost.consumable[24] && user.gold >= cost.gold) {
					minLevel = hero.titanGiftLevel;
					heroId = hero.id;
				}
			}

			return heroId;
		}

		getHeroicMissionId() {
			// Получаем доступные миссии с 3 звездами
			const availableMissionsToRaid = Object.values(this.questInfo.missionGetAll)
				.filter((mission) => mission.stars === 3)
				.map((mission) => mission.id);

			// Получаем героев для улучшения, у которых меньше 6 звезд
			const heroesToUpgrade = Object.values(this.questInfo.heroGetAll)
				.filter((hero) => hero.star < 6)
				.sort((a, b) => b.power - a.power)
				.map((hero) => hero.id);

			// Получаем героические миссии, которые доступны для рейдов
			const heroicMissions = Object.values(lib.data.mission).filter((mission) => mission.isHeroic && availableMissionsToRaid.includes(mission.id));

			// Собираем дропы из героических миссий
			const drops = heroicMissions.map((mission) => {
				const lastWave = mission.normalMode.waves[mission.normalMode.waves.length - 1];
				const allRewards = lastWave.enemies[lastWave.enemies.length - 1]
					.drop.map((drop) => drop.reward);

				const heroId = +Object.keys(allRewards.find((reward) => reward.fragmentHero).fragmentHero).pop();

				return { id: mission.id, heroId };
			});

			// Определяем, какие дропы подходят для героев, которых нужно улучшить
			const heroDrops = heroesToUpgrade.map((heroId) => drops.find((drop) => drop.heroId == heroId)).filter((drop) => drop);
			const firstMission = heroDrops[0];
			// Выбираем миссию для рейда
			const selectedMissionId = firstMission ? firstMission.id : 1;

			const stamina = this.questInfo.userGetInfo.refillable.find((x) => x.id == 1).amount;
			const costMissions = 3 * lib.data.mission[selectedMissionId].normalMode.teamExp;
			if (stamina < costMissions) {
				console.log('Энергии не достаточно');
				return 0;
			}
			return selectedMissionId;
		}

		end(status) {
			setProgress(status, true);
			this.resolve();
		}
	}

	this.questRun = dailyQuests;
	this.HWHClasses.dailyQuests = dailyQuests;

	function testDoYourBest() {
		const { doYourBest } = HWHClasses;
		return new Promise((resolve, reject) => {
			const doIt = new doYourBest(resolve, reject);
			doIt.isAuto = true;
			doIt.start();
		});
	}

	/**
	 * Do everything button
	 *
	 * Кнопка сделать все
	 */
	class doYourBest {
		isAuto = false;

		funcList = [
			{
				name: 'getOutland',
				label: I18N('ASSEMBLE_OUTLAND'),
				checked: false
			},
			{
				name: 'testTower',
				label: I18N('PASS_THE_TOWER'),
				checked: false
			},
			{
				name: 'checkExpedition',
				label: I18N('CHECK_EXPEDITIONS'),
				checked: false
			},
			{
				name: 'testTitanArena',
				label: I18N('COMPLETE_TOE'),
				checked: false
			},
			{
				name: 'testBothArenas',
				label: I18N('AUTO_ARENAS'),
				checked: false
			},
			{
				name: 'testGuildWar',
				label: I18N('GUILD_WAR'),
				checked: false
			},
			{
				name: 'mailGetAll',
				label: I18N('COLLECT_MAIL'),
				checked: false
			},
			{
				name: 'collectAllStuff',
				label: I18N('COLLECT_MISC'),
				title: I18N('COLLECT_MISC_TITLE'),
				checked: false
			},
			{
				name: 'getDailyBonus',
				label: I18N('DAILY_BONUS'),
				checked: false
			},
			{
				name: 'dailyQuests',
				label: I18N('DO_DAILY_QUESTS'),
				checked: false
			},
			{
				name: 'rollAscension',
				label: I18N('SEER_TITLE'),
				checked: false
			},
			{
				name: 'questAllFarm',
				label: I18N('COLLECT_QUEST_REWARDS'),
				checked: false
			},
			{
				name: 'testDungeon',
				label: I18N('COMPLETE_DUNGEON'),
				checked: false
			},
			{
				name: 'synchronization',
				label: I18N('MAKE_A_SYNC'),
				checked: false
			},
			{
				name: 'reloadGame',
				label: I18N('RELOAD_GAME'),
				checked: false
			},
		];

		functions = {
			getOutland,
			testTower,
			checkExpedition,
			testTitanArena,
			testBothArenas,
			testGuildWar,
			mailGetAll,
			collectAllStuff: async () => {
				await offerFarmAllReward();
				await Send('{"calls":[{"name":"subscriptionFarm","args":{},"ident":"body"},{"name":"zeppelinGiftFarm","args":{},"ident":"zeppelinGiftFarm"},{"name":"grandFarmCoins","args":{},"ident":"grandFarmCoins"},{"name":"gacha_refill","args":{"ident":"heroGacha"},"ident":"gacha_refill"}]}');
			},
			dailyQuests: async function () {
				const quests = new dailyQuests(() => { }, () => { });
				await quests.autoInit(true);
				await quests.start();
			},
			rollAscension,
			getDailyBonus,
			questAllFarm,
			testDungeon,
			synchronization: async () => {
				cheats.refreshGame();
			},
			reloadGame: async () => {
				location.reload();
			},
		}

		constructor(resolve, reject, questInfo) {
			this.resolve = resolve;
			this.reject = reject;
			this.questInfo = questInfo
		}

		async start() {
			const selectedDoIt = getSaveVal('selectedDoIt', {});

			if (this.isAuto) {
				// Auto mode: check all functions except reloadGame and skip popup
				this.funcList.forEach(task => {
					if (task.name !== 'reloadGame') {
						task.checked = true;
						selectedDoIt[task.name] = { checked: true };
					} else {
						task.checked = false;
						selectedDoIt[task.name] = { checked: false };
					}
				});
				setSaveVal('selectedDoIt', selectedDoIt);
			} else {
				// Manual mode: show popup
				this.funcList.forEach(task => {
					if (!selectedDoIt[task.name]) {
						selectedDoIt[task.name] = {
							checked: task.checked
						}
					} else {
						task.checked = selectedDoIt[task.name].checked
					}
				});

				const answer = await popup.confirm(I18N('RUN_FUNCTION'), [
					{ msg: I18N('BTN_CANCEL'), result: false, isCancel: true },
					{ msg: I18N('BTN_GO'), result: true },
				], this.funcList);

				if (!answer) {
					this.end('');
					return;
				}

				const taskList = popup.getCheckBoxes();
				taskList.forEach(task => {
					selectedDoIt[task.name].checked = task.checked;
				});
				setSaveVal('selectedDoIt', selectedDoIt);
			}

			// Execute all checked functions
			for (const task of this.funcList) {
				if (task.checked) {
					try {
						setProgress(`${task.label} <br>${I18N('PERFORMED')}!`);
						await this.functions[task.name]();
						setProgress(`${task.label} <br>${I18N('DONE')}!`);
					} catch (error) {
						if (await popup.confirm(`${I18N('ERRORS_OCCURRES')}:<br> ${task.label} <br>${I18N('COPY_ERROR')}?`, [
							{ msg: I18N('BTN_NO'), result: false },
							{ msg: I18N('BTN_YES'), result: true },
						])) {
							this.errorHandling(error);
						}
					}
				}
			}
			setTimeout((msg) => {
				this.end(msg);
			}, 2000, I18N('ALL_TASK_COMPLETED'));
			return;
		}

		errorHandling(error) {
			//console.error(error);
			let errorInfo = error.toString() + '\n';
			try {
				const errorStack = error.stack.split('\n');
				const endStack = errorStack.map(e => e.split('@')[0]).indexOf("testDoYourBest");
				errorInfo += errorStack.slice(0, endStack).join('\n');
			} catch (e) {
				errorInfo += error.stack;
			}
			copyText(errorInfo);
		}

		end(status) {
			setProgress(status, true);
			this.resolve();
		}
	}

	this.HWHClasses.doYourBest = doYourBest;

	/**
	 * Passing the adventure along the specified route
	 *
	 * Прохождение приключения по указанному маршруту
	 */
	function testAdventure(type) {
		const { executeAdventure } = HWHClasses;
		return new Promise((resolve, reject) => {
			const bossBattle = new executeAdventure(resolve, reject);
			bossBattle.start(type);
		});
	}

	/**
	 * Passing the adventure along the specified route
	 *
	 * Прохождение приключения по указанному маршруту
	 */
	class executeAdventure {

		type = 'default';

		actions = {
			default: {
				getInfo: "adventure_getInfo",
				startBattle: 'adventure_turnStartBattle',
				endBattle: 'adventure_endBattle',
				collectBuff: 'adventure_turnCollectBuff'
			},
			solo: {
				getInfo: "adventureSolo_getInfo",
				startBattle: 'adventureSolo_turnStartBattle',
				endBattle: 'adventureSolo_endBattle',
				collectBuff: 'adventureSolo_turnCollectBuff'
			}
		}

		terminatеReason = I18N('UNKNOWN');
		callAdventureInfo = {
			name: "adventure_getInfo",
			args: {},
			ident: "adventure_getInfo"
		}
		callTeamGetAll = {
			name: "teamGetAll",
			args: {},
			ident: "teamGetAll"
		}
		callTeamGetFavor = {
			name: "teamGetFavor",
			args: {},
			ident: "teamGetFavor"
		}
		callStartBattle = {
			name: "adventure_turnStartBattle",
			args: {},
			ident: "body"
		}
		callEndBattle = {
			name: "adventure_endBattle",
			args: {
				result: {},
				progress: {},
			},
			ident: "body"
		}
		callCollectBuff = {
			name: "adventure_turnCollectBuff",
			args: {},
			ident: "body"
		}

		constructor(resolve, reject) {
			this.resolve = resolve;
			this.reject = reject;
		}

		async start(type) {
			this.type = type || this.type;
			this.callAdventureInfo.name = this.actions[this.type].getInfo;
			const data = await Send(JSON.stringify({
				calls: [
					this.callAdventureInfo,
					this.callTeamGetAll,
					this.callTeamGetFavor
				]
			}));
			return this.checkAdventureInfo(data.results);
		}

		async getPath() {
			const oldVal = getSaveVal('adventurePath', '');
			const keyPath = `adventurePath:${this.mapIdent}`;
			const answer = await popup.confirm(I18N('ENTER_THE_PATH'), [
				{
					msg: I18N('START_ADVENTURE'),
					placeholder: '1,2,3,4,5,6',
					isInput: true,
					default: getSaveVal(keyPath, oldVal)
				},
				{
					msg: I18N('BTN_CANCEL'),
					result: false,
					isCancel: true
				},
			]);
			if (!answer) {
				this.terminatеReason = I18N('BTN_CANCELED');
				return false;
			}

			let path = answer.split(',');
			if (path.length < 2) {
				path = answer.split('-');
			}
			if (path.length < 2) {
				this.terminatеReason = I18N('MUST_TWO_POINTS');
				return false;
			}

			for (let p in path) {
				path[p] = +path[p].trim()
				if (Number.isNaN(path[p])) {
					this.terminatеReason = I18N('MUST_ONLY_NUMBERS');
					return false;
				}
			}

			if (!this.checkPath(path)) {
				return false;
			}
			setSaveVal(keyPath, answer);
			return path;
		}

		checkPath(path) {
			for (let i = 0; i < path.length - 1; i++) {
				const currentPoint = path[i];
				const nextPoint = path[i + 1];

				const isValidPath = this.paths.some(p =>
					(p.from_id === currentPoint && p.to_id === nextPoint) ||
					(p.from_id === nextPoint && p.to_id === currentPoint)
				);

				if (!isValidPath) {
					this.terminatеReason = I18N('INCORRECT_WAY', {
						from: currentPoint,
						to: nextPoint,
					});
					return false;
				}
			}

			return true;
		}

		async checkAdventureInfo(data) {
			this.advInfo = data[0].result.response;
			if (!this.advInfo) {
				this.terminatеReason = I18N('NOT_ON_AN_ADVENTURE') ;
				return this.end();
			}
			const heroesTeam = data[1].result.response.adventure_hero;
			const favor = data[2]?.result.response.adventure_hero;
			const heroes = heroesTeam.slice(0, 5);
			const pet = heroesTeam[5];
			this.args = {
				pet,
				heroes,
				favor,
				path: [],
				broadcast: false
			}
			const advUserInfo = this.advInfo.users[userInfo.id];
			this.turnsLeft = advUserInfo.turnsLeft;
			this.currentNode = advUserInfo.currentNode;
			this.nodes = this.advInfo.nodes;
			this.paths = this.advInfo.paths;
			this.mapIdent = this.advInfo.mapIdent;

			this.path = await this.getPath();
			if (!this.path) {
				return this.end();
			}

			if (this.currentNode == 1 && this.path[0] != 1) {
				this.path.unshift(1);
			}

			return this.loop();
		}

		async loop() {
			const position = this.path.indexOf(+this.currentNode);
			if (!(~position)) {
				this.terminatеReason = I18N('YOU_IN_NOT_ON_THE_WAY');
				return this.end();
			}
			this.path = this.path.slice(position);
			if ((this.path.length - 1) > this.turnsLeft &&
				await popup.confirm(I18N('ATTEMPTS_NOT_ENOUGH'), [
					{ msg: I18N('YES_CONTINUE'), result: false },
					{ msg: I18N('BTN_NO'), result: true },
				])) {
				this.terminatеReason = I18N('NOT_ENOUGH_AP');
				return this.end();
			}
			const toPath = [];
			for (const nodeId of this.path) {
				if (!this.turnsLeft) {
					this.terminatеReason = I18N('ATTEMPTS_ARE_OVER');
					return this.end();
				}
				toPath.push(nodeId);
				console.log(toPath);
				if (toPath.length > 1) {
					setProgress(toPath.join(' > ') + ` ${I18N('MOVES')}: ` + this.turnsLeft);
				}
				if (nodeId == this.currentNode) {
					continue;
				}

				const nodeInfo = this.getNodeInfo(nodeId);
				if (nodeInfo.type == 'TYPE_COMBAT') {
					if (nodeInfo.state == 'empty') {
						this.turnsLeft--;
						continue;
					}

					/**
					 * Disable regular battle cancellation
					 *
					 * Отключаем штатную отменую боя
					 */
					setIsCancalBattle(false);
					if (await this.battle(toPath)) {
						this.turnsLeft--;
						toPath.splice(0, toPath.indexOf(nodeId));
						nodeInfo.state = 'empty';
						setIsCancalBattle(true);
						continue;
					}
					setIsCancalBattle(true);
					return this.end()
				}

				if (nodeInfo.type == 'TYPE_PLAYERBUFF') {
					const buff = this.checkBuff(nodeInfo);
					if (buff == null) {
						continue;
					}

					if (await this.collectBuff(buff, toPath)) {
						this.turnsLeft--;
						toPath.splice(0, toPath.indexOf(nodeId));
						continue;
					}
					this.terminatеReason = I18N('BUFF_GET_ERROR');
					return this.end();
				}
			}
			this.terminatеReason = I18N('SUCCESS');
			return this.end();
		}

		/**
		 * Carrying out a fight
		 *
		 * Проведение боя
		 */
		async battle(path, preCalc = true) {
			const data = await this.startBattle(path);
			try {
				const battle = data.results[0].result.response.battle;
				let result = await Calc(battle);

				if (!result.result.win && isChecked('tryFixIt_v2')) {
					const cloneBattle = structuredClone(battle);
					const bFix = new WinFixBattle(cloneBattle);
					const endTime = Date.now() + 3e4; // 30 sec
					const fixResult = await bFix.start(endTime, 500);
					console.log(fixResult);
					if (fixResult.result?.win) {
						result = fixResult;
					}
				}

				if (result.result.win) {
					const info = await this.endBattle(result);
					if (info.results[0].result.response?.error) {
						this.terminatеReason = I18N('BATTLE_END_ERROR');
						return false;
					}
				} else {
					await this.cancelBattle(result);

					if (preCalc && await this.preCalcBattle(battle)) {
						path = path.slice(-2);
						for (let i = 1; i <= getInput('countAutoBattle'); i++) {
							setProgress(`${I18N('AUTOBOT')}: ${i}/${getInput('countAutoBattle')}`);
							const result = await this.battle(path, false);
							if (result) {
								setProgress(I18N('VICTORY'));
								return true;
							}
						}
						this.terminatеReason = I18N('FAILED_TO_WIN_AUTO');
						return false;
					}
					return false;
				}
			} catch (error) {
				console.error(error);
				if (await popup.confirm(I18N('ERROR_OF_THE_BATTLE_COPY'), [
					{ msg: I18N('BTN_NO'), result: false },
					{ msg: I18N('BTN_YES'), result: true },
				])) {
					this.errorHandling(error, data);
				}
				this.terminatеReason = I18N('ERROR_DURING_THE_BATTLE');
				return false;
			}
			return true;
		}

		/**
		 * Recalculate battles
		 *
		 * Прерасчтет битвы
		 */
		async preCalcBattle(battle) {
			const countTestBattle = getInput('countTestBattle');
			for (let i = 0; i < countTestBattle; i++) {
				battle.seed = Math.floor(Date.now() / 1000) + random(0, 1e3);
				const result = await Calc(battle);
				if (result.result.win) {
					console.log(i, countTestBattle);
					return true;
				}
			}
			this.terminatеReason = I18N('NO_CHANCE_WIN') + countTestBattle;
			return false;
		}

		/**
		 * Starts a fight
		 *
		 * Начинает бой
		 */
		startBattle(path) {
			this.args.path = path;
			this.callStartBattle.name = this.actions[this.type].startBattle;
			this.callStartBattle.args = this.args
			const calls = [this.callStartBattle];
			return Send(JSON.stringify({ calls }));
		}

		cancelBattle(battle) {
			const fixBattle = function (heroes) {
				for (const ids in heroes) {
					const hero = heroes[ids];
					hero.energy = random(1, 999);
					if (hero.hp > 0) {
						hero.hp = random(1, hero.hp);
					}
				}
			}
			fixBattle(battle.progress[0].attackers.heroes);
			fixBattle(battle.progress[0].defenders.heroes);
			return this.endBattle(battle);
		}

		/**
		 * Ends the fight
		 *
		 * Заканчивает бой
		 */
		endBattle(battle) {
			this.callEndBattle.name = this.actions[this.type].endBattle;
			this.callEndBattle.args.result = battle.result
			this.callEndBattle.args.progress = battle.progress
			const calls = [this.callEndBattle];
			return Send(JSON.stringify({ calls }));
		}

		/**
		 * Checks if you can get a buff
		 *
		 * Проверяет можно ли получить баф
		 */
		checkBuff(nodeInfo) {
			let id = null;
			let value = 0;
			for (const buffId in nodeInfo.buffs) {
				const buff = nodeInfo.buffs[buffId];
				if (buff.owner == null && buff.value > value) {
					id = buffId;
					value = buff.value;
				}
			}
			nodeInfo.buffs[id].owner = 'Я';
			return id;
		}

		/**
		 * Collects a buff
		 *
		 * Собирает баф
		 */
		async collectBuff(buff, path) {
			this.callCollectBuff.name = this.actions[this.type].collectBuff;
			this.callCollectBuff.args = { buff, path };
			const calls = [this.callCollectBuff];
			return Send(JSON.stringify({ calls }));
		}

		getNodeInfo(nodeId) {
			return this.nodes.find(node => node.id == nodeId);
		}

		errorHandling(error, data) {
			//console.error(error);
			let errorInfo = error.toString() + '\n';
			try {
				const errorStack = error.stack.split('\n');
				const endStack = errorStack.map(e => e.split('@')[0]).indexOf("testAdventure");
				errorInfo += errorStack.slice(0, endStack).join('\n');
			} catch (e) {
				errorInfo += error.stack;
			}
			if (data) {
				errorInfo += '\nData: ' + JSON.stringify(data);
			}
			copyText(errorInfo);
		}

		end() {
			setIsCancalBattle(true);
			setProgress(this.terminatеReason, true);
			console.log(this.terminatеReason);
			this.resolve();
		}
	}

	this.HWHClasses.executeAdventure = executeAdventure;

	/**
	 * Passage of brawls
	 *
	 * Прохождение потасовок
	 */
	function testBrawls(isAuto) {
		const { executeBrawls } = HWHClasses;
		return new Promise((resolve, reject) => {
			const brawls = new executeBrawls(resolve, reject);
			brawls.start(brawlsPack, isAuto);
		});
	}
	/**
	 * Passage of brawls
	 *
	 * Прохождение потасовок
	 */
	class executeBrawls {

		static isBrawlsAutoStart = false;

		callBrawlQuestGetInfo = {
			name: "brawl_questGetInfo",
			args: {},
			ident: "brawl_questGetInfo"
		}
		callBrawlFindEnemies = {
			name: "brawl_findEnemies",
			args: {},
			ident: "brawl_findEnemies"
		}
		callBrawlQuestFarm = {
			name: "brawl_questFarm",
			args: {},
			ident: "brawl_questFarm"
		}
		callUserGetInfo = {
			name: "userGetInfo",
			args: {},
			ident: "userGetInfo"
		}
		callTeamGetMaxUpgrade = {
			name: "teamGetMaxUpgrade",
			args: {},
			ident: "teamGetMaxUpgrade"
		}
		callBrawlGetInfo = {
			name: "brawl_getInfo",
			args: {},
			ident: "brawl_getInfo"
		}

		stats = {
			win: 0,
			loss: 0,
			count: 0,
		}

		stage = {
			'3': 1,
			'7': 2,
			'12': 3,
		}

		attempts = 0;

		constructor(resolve, reject) {
			this.resolve = resolve;
			this.reject = reject;

			const allHeroIds = Object.keys(lib.getData('hero'));
			this.callTeamGetMaxUpgrade.args.units = {
				hero: allHeroIds.filter((id) => +id < 1000),
				titan: allHeroIds.filter((id) => +id >= 4000 && +id < 4100),
				pet: allHeroIds.filter((id) => +id >= 6000 && +id < 6100),
			};
		}

		async start(args, isAuto) {
			const { executeBrawls } = HWHClasses;
			this.isAuto = isAuto;
			this.args = args;
			setIsCancalBattle(false);
			this.brawlInfo = await this.getBrawlInfo();
			this.attempts = this.brawlInfo.attempts;

			if (!this.attempts && !this.info.boughtEndlessLivesToday) {
				this.end(I18N('DONT_HAVE_LIVES'));
				return;
			}

			while (1) {
				if (!executeBrawls.isBrawlsAutoStart) {
					this.end(I18N('BTN_CANCELED'));
					return;
				}

				const maxStage = this.brawlInfo.questInfo.stage;
				const stage = this.stage[maxStage];
				const progress = this.brawlInfo.questInfo.progress;

				setProgress(
					`${I18N('STAGE')} ${stage}: ${progress}/${maxStage}<br>${I18N('FIGHTS')}: ${this.stats.count}<br>${I18N('WINS')}: ${
						this.stats.win
					}<br>${I18N('LOSSES')}: ${this.stats.loss}<br>${I18N('LIVES')}: ${this.attempts}<br>${I18N('STOP')}`,
					false,
					function () {
						executeBrawls.isBrawlsAutoStart = false;
					}
				);

				if (this.brawlInfo.questInfo.canFarm) {
					const result = await this.questFarm();
					console.log(result);
				}

				if (!this.continueAttack && this.brawlInfo.questInfo.stage == 12 && this.brawlInfo.questInfo.progress == 12) {
					this.end(I18N('SUCCESS'));
					return;
					/*
					// "Ежедневное задание выполнено, продолжить атаку?"
					if (
						await popup.confirm(I18N('BRAWL_DAILY_TASK_COMPLETED'), [
							{ msg: I18N('BTN_NO'), result: true },
							{ msg: I18N('BTN_YES'), result: false },
						])
					) {
						this.end(I18N('SUCCESS'));
						return;
					} else {
						this.continueAttack = true;
					}
					*/
				}

				if (!this.attempts && !this.info.boughtEndlessLivesToday) {
					this.end(I18N('DONT_HAVE_LIVES'));
					return;
				}

				const enemie = Object.values(this.brawlInfo.findEnemies).shift();

				// Автоматический подбор пачки
				if (this.isAuto) {
					if (this.mandatoryId <= 4000 && this.mandatoryId != 13) {
						this.end(I18N('BRAWL_AUTO_PACK_NOT_CUR_HERO'));
						return;
					}
					if (this.mandatoryId >= 4000 && this.mandatoryId < 4100) {
						this.args = await this.updateTitanPack(enemie.heroes);
					} else if (this.mandatoryId < 4000 && this.mandatoryId == 13) {
						this.args = await this.updateHeroesPack(enemie.heroes);
					}
				}

				const result = await this.battle(enemie.userId);
				this.brawlInfo = {
					questInfo: result[1].result.response,
					findEnemies: result[2].result.response,
				};
			}
		}

		async updateTitanPack(enemieHeroes) {
			const packs = [
				[4033, 4040, 4041, 4042, 4043],
				[4032, 4040, 4041, 4042, 4043],
				[4031, 4040, 4041, 4042, 4043],
				[4030, 4040, 4041, 4042, 4043],
				[4032, 4033, 4040, 4042, 4043],
				[4030, 4033, 4041, 4042, 4043],
				[4031, 4033, 4040, 4042, 4043],
				[4032, 4033, 4040, 4041, 4043],
				[4023, 4040, 4041, 4042, 4043],
				[4030, 4033, 4040, 4042, 4043],
				[4031, 4033, 4040, 4041, 4043],
				[4022, 4040, 4041, 4042, 4043],
				[4030, 4033, 4040, 4041, 4043],
				[4021, 4040, 4041, 4042, 4043],
				[4020, 4040, 4041, 4042, 4043],
				[4023, 4033, 4040, 4042, 4043],
				[4030, 4032, 4033, 4042, 4043],
				[4023, 4033, 4040, 4041, 4043],
				[4031, 4032, 4033, 4040, 4043],
				[4030, 4032, 4033, 4041, 4043],
				[4030, 4031, 4033, 4042, 4043],
				[4013, 4040, 4041, 4042, 4043],
				[4030, 4032, 4033, 4040, 4043],
				[4030, 4031, 4033, 4041, 4043],
				[4012, 4040, 4041, 4042, 4043],
				[4030, 4031, 4033, 4040, 4043],
				[4011, 4040, 4041, 4042, 4043],
				[4010, 4040, 4041, 4042, 4043],
				[4023, 4032, 4033, 4042, 4043],
				[4022, 4032, 4033, 4042, 4043],
				[4023, 4032, 4033, 4041, 4043],
				[4021, 4032, 4033, 4042, 4043],
				[4022, 4032, 4033, 4041, 4043],
				[4023, 4030, 4033, 4042, 4043],
				[4023, 4032, 4033, 4040, 4043],
				[4013, 4033, 4040, 4042, 4043],
				[4020, 4032, 4033, 4042, 4043],
				[4021, 4032, 4033, 4041, 4043],
				[4022, 4030, 4033, 4042, 4043],
				[4022, 4032, 4033, 4040, 4043],
				[4023, 4030, 4033, 4041, 4043],
				[4023, 4031, 4033, 4040, 4043],
				[4013, 4033, 4040, 4041, 4043],
				[4020, 4031, 4033, 4042, 4043],
				[4020, 4032, 4033, 4041, 4043],
				[4021, 4030, 4033, 4042, 4043],
				[4021, 4032, 4033, 4040, 4043],
				[4022, 4030, 4033, 4041, 4043],
				[4022, 4031, 4033, 4040, 4043],
				[4023, 4030, 4033, 4040, 4043],
				[4030, 4031, 4032, 4033, 4043],
				[4003, 4040, 4041, 4042, 4043],
				[4020, 4030, 4033, 4042, 4043],
				[4020, 4031, 4033, 4041, 4043],
				[4020, 4032, 4033, 4040, 4043],
				[4021, 4030, 4033, 4041, 4043],
				[4021, 4031, 4033, 4040, 4043],
				[4022, 4030, 4033, 4040, 4043],
				[4030, 4031, 4032, 4033, 4042],
				[4002, 4040, 4041, 4042, 4043],
				[4020, 4030, 4033, 4041, 4043],
				[4020, 4031, 4033, 4040, 4043],
				[4021, 4030, 4033, 4040, 4043],
				[4030, 4031, 4032, 4033, 4041],
				[4001, 4040, 4041, 4042, 4043],
				[4030, 4031, 4032, 4033, 4040],
				[4000, 4040, 4041, 4042, 4043],
				[4013, 4032, 4033, 4042, 4043],
				[4012, 4032, 4033, 4042, 4043],
				[4013, 4032, 4033, 4041, 4043],
				[4023, 4031, 4032, 4033, 4043],
				[4011, 4032, 4033, 4042, 4043],
				[4012, 4032, 4033, 4041, 4043],
				[4013, 4030, 4033, 4042, 4043],
				[4013, 4032, 4033, 4040, 4043],
				[4023, 4030, 4032, 4033, 4043],
				[4003, 4033, 4040, 4042, 4043],
				[4013, 4023, 4040, 4042, 4043],
				[4010, 4032, 4033, 4042, 4043],
				[4011, 4032, 4033, 4041, 4043],
				[4012, 4030, 4033, 4042, 4043],
				[4012, 4032, 4033, 4040, 4043],
				[4013, 4030, 4033, 4041, 4043],
				[4013, 4031, 4033, 4040, 4043],
				[4023, 4030, 4031, 4033, 4043],
				[4003, 4033, 4040, 4041, 4043],
				[4013, 4023, 4040, 4041, 4043],
				[4010, 4031, 4033, 4042, 4043],
				[4010, 4032, 4033, 4041, 4043],
				[4011, 4030, 4033, 4042, 4043],
				[4011, 4032, 4033, 4040, 4043],
				[4012, 4030, 4033, 4041, 4043],
				[4012, 4031, 4033, 4040, 4043],
				[4013, 4030, 4033, 4040, 4043],
				[4010, 4030, 4033, 4042, 4043],
				[4010, 4031, 4033, 4041, 4043],
				[4010, 4032, 4033, 4040, 4043],
				[4011, 4030, 4033, 4041, 4043],
				[4011, 4031, 4033, 4040, 4043],
				[4012, 4030, 4033, 4040, 4043],
				[4010, 4030, 4033, 4041, 4043],
				[4010, 4031, 4033, 4040, 4043],
				[4011, 4030, 4033, 4040, 4043],
				[4003, 4032, 4033, 4042, 4043],
				[4002, 4032, 4033, 4042, 4043],
				[4003, 4032, 4033, 4041, 4043],
				[4013, 4031, 4032, 4033, 4043],
				[4001, 4032, 4033, 4042, 4043],
				[4002, 4032, 4033, 4041, 4043],
				[4003, 4030, 4033, 4042, 4043],
				[4003, 4032, 4033, 4040, 4043],
				[4013, 4030, 4032, 4033, 4043],
				[4003, 4023, 4040, 4042, 4043],
				[4000, 4032, 4033, 4042, 4043],
				[4001, 4032, 4033, 4041, 4043],
				[4002, 4030, 4033, 4042, 4043],
				[4002, 4032, 4033, 4040, 4043],
				[4003, 4030, 4033, 4041, 4043],
				[4003, 4031, 4033, 4040, 4043],
				[4020, 4022, 4023, 4042, 4043],
				[4013, 4030, 4031, 4033, 4043],
				[4003, 4023, 4040, 4041, 4043],
				[4000, 4031, 4033, 4042, 4043],
				[4000, 4032, 4033, 4041, 4043],
				[4001, 4030, 4033, 4042, 4043],
				[4001, 4032, 4033, 4040, 4043],
				[4002, 4030, 4033, 4041, 4043],
				[4002, 4031, 4033, 4040, 4043],
				[4003, 4030, 4033, 4040, 4043],
				[4021, 4022, 4023, 4040, 4043],
				[4020, 4022, 4023, 4041, 4043],
				[4020, 4021, 4023, 4042, 4043],
				[4023, 4030, 4031, 4032, 4033],
				[4000, 4030, 4033, 4042, 4043],
				[4000, 4031, 4033, 4041, 4043],
				[4000, 4032, 4033, 4040, 4043],
				[4001, 4030, 4033, 4041, 4043],
				[4001, 4031, 4033, 4040, 4043],
				[4002, 4030, 4033, 4040, 4043],
				[4020, 4022, 4023, 4040, 4043],
				[4020, 4021, 4023, 4041, 4043],
				[4022, 4030, 4031, 4032, 4033],
				[4000, 4030, 4033, 4041, 4043],
				[4000, 4031, 4033, 4040, 4043],
				[4001, 4030, 4033, 4040, 4043],
				[4020, 4021, 4023, 4040, 4043],
				[4021, 4030, 4031, 4032, 4033],
				[4020, 4030, 4031, 4032, 4033],
				[4003, 4031, 4032, 4033, 4043],
				[4020, 4022, 4023, 4033, 4043],
				[4003, 4030, 4032, 4033, 4043],
				[4003, 4013, 4040, 4042, 4043],
				[4020, 4021, 4023, 4033, 4043],
				[4003, 4030, 4031, 4033, 4043],
				[4003, 4013, 4040, 4041, 4043],
				[4013, 4030, 4031, 4032, 4033],
				[4012, 4030, 4031, 4032, 4033],
				[4011, 4030, 4031, 4032, 4033],
				[4010, 4030, 4031, 4032, 4033],
				[4013, 4023, 4031, 4032, 4033],
				[4013, 4023, 4030, 4032, 4033],
				[4020, 4022, 4023, 4032, 4033],
				[4013, 4023, 4030, 4031, 4033],
				[4021, 4022, 4023, 4030, 4033],
				[4020, 4022, 4023, 4031, 4033],
				[4020, 4021, 4023, 4032, 4033],
				[4020, 4021, 4022, 4023, 4043],
				[4003, 4030, 4031, 4032, 4033],
				[4020, 4022, 4023, 4030, 4033],
				[4020, 4021, 4023, 4031, 4033],
				[4020, 4021, 4022, 4023, 4042],
				[4002, 4030, 4031, 4032, 4033],
				[4020, 4021, 4023, 4030, 4033],
				[4020, 4021, 4022, 4023, 4041],
				[4001, 4030, 4031, 4032, 4033],
				[4020, 4021, 4022, 4023, 4040],
				[4000, 4030, 4031, 4032, 4033],
				[4003, 4023, 4031, 4032, 4033],
				[4013, 4020, 4022, 4023, 4043],
				[4003, 4023, 4030, 4032, 4033],
				[4010, 4012, 4013, 4042, 4043],
				[4013, 4020, 4021, 4023, 4043],
				[4003, 4023, 4030, 4031, 4033],
				[4011, 4012, 4013, 4040, 4043],
				[4010, 4012, 4013, 4041, 4043],
				[4010, 4011, 4013, 4042, 4043],
				[4020, 4021, 4022, 4023, 4033],
				[4010, 4012, 4013, 4040, 4043],
				[4010, 4011, 4013, 4041, 4043],
				[4020, 4021, 4022, 4023, 4032],
				[4010, 4011, 4013, 4040, 4043],
				[4020, 4021, 4022, 4023, 4031],
				[4020, 4021, 4022, 4023, 4030],
				[4003, 4013, 4031, 4032, 4033],
				[4010, 4012, 4013, 4033, 4043],
				[4003, 4020, 4022, 4023, 4043],
				[4013, 4020, 4022, 4023, 4033],
				[4003, 4013, 4030, 4032, 4033],
				[4010, 4011, 4013, 4033, 4043],
				[4003, 4020, 4021, 4023, 4043],
				[4013, 4020, 4021, 4023, 4033],
				[4003, 4013, 4030, 4031, 4033],
				[4010, 4012, 4013, 4023, 4043],
				[4003, 4020, 4022, 4023, 4033],
				[4010, 4012, 4013, 4032, 4033],
				[4010, 4011, 4013, 4023, 4043],
				[4003, 4020, 4021, 4023, 4033],
				[4011, 4012, 4013, 4030, 4033],
				[4010, 4012, 4013, 4031, 4033],
				[4010, 4011, 4013, 4032, 4033],
				[4013, 4020, 4021, 4022, 4023],
				[4010, 4012, 4013, 4030, 4033],
				[4010, 4011, 4013, 4031, 4033],
				[4012, 4020, 4021, 4022, 4023],
				[4010, 4011, 4013, 4030, 4033],
				[4011, 4020, 4021, 4022, 4023],
				[4010, 4020, 4021, 4022, 4023],
				[4010, 4012, 4013, 4023, 4033],
				[4000, 4002, 4003, 4042, 4043],
				[4010, 4011, 4013, 4023, 4033],
				[4001, 4002, 4003, 4040, 4043],
				[4000, 4002, 4003, 4041, 4043],
				[4000, 4001, 4003, 4042, 4043],
				[4010, 4011, 4012, 4013, 4043],
				[4003, 4020, 4021, 4022, 4023],
				[4000, 4002, 4003, 4040, 4043],
				[4000, 4001, 4003, 4041, 4043],
				[4010, 4011, 4012, 4013, 4042],
				[4002, 4020, 4021, 4022, 4023],
				[4000, 4001, 4003, 4040, 4043],
				[4010, 4011, 4012, 4013, 4041],
				[4001, 4020, 4021, 4022, 4023],
				[4010, 4011, 4012, 4013, 4040],
				[4000, 4020, 4021, 4022, 4023],
				[4001, 4002, 4003, 4033, 4043],
				[4000, 4002, 4003, 4033, 4043],
				[4003, 4010, 4012, 4013, 4043],
				[4003, 4013, 4020, 4022, 4023],
				[4000, 4001, 4003, 4033, 4043],
				[4003, 4010, 4011, 4013, 4043],
				[4003, 4013, 4020, 4021, 4023],
				[4010, 4011, 4012, 4013, 4033],
				[4010, 4011, 4012, 4013, 4032],
				[4010, 4011, 4012, 4013, 4031],
				[4010, 4011, 4012, 4013, 4030],
				[4001, 4002, 4003, 4023, 4043],
				[4000, 4002, 4003, 4023, 4043],
				[4003, 4010, 4012, 4013, 4033],
				[4000, 4002, 4003, 4032, 4033],
				[4000, 4001, 4003, 4023, 4043],
				[4003, 4010, 4011, 4013, 4033],
				[4001, 4002, 4003, 4030, 4033],
				[4000, 4002, 4003, 4031, 4033],
				[4000, 4001, 4003, 4032, 4033],
				[4010, 4011, 4012, 4013, 4023],
				[4000, 4002, 4003, 4030, 4033],
				[4000, 4001, 4003, 4031, 4033],
				[4010, 4011, 4012, 4013, 4022],
				[4000, 4001, 4003, 4030, 4033],
				[4010, 4011, 4012, 4013, 4021],
				[4010, 4011, 4012, 4013, 4020],
				[4001, 4002, 4003, 4013, 4043],
				[4001, 4002, 4003, 4023, 4033],
				[4000, 4002, 4003, 4013, 4043],
				[4000, 4002, 4003, 4023, 4033],
				[4003, 4010, 4012, 4013, 4023],
				[4000, 4001, 4003, 4013, 4043],
				[4000, 4001, 4003, 4023, 4033],
				[4003, 4010, 4011, 4013, 4023],
				[4001, 4002, 4003, 4013, 4033],
				[4000, 4002, 4003, 4013, 4033],
				[4000, 4001, 4003, 4013, 4033],
				[4000, 4001, 4002, 4003, 4043],
				[4003, 4010, 4011, 4012, 4013],
				[4000, 4001, 4002, 4003, 4042],
				[4002, 4010, 4011, 4012, 4013],
				[4000, 4001, 4002, 4003, 4041],
				[4001, 4010, 4011, 4012, 4013],
				[4000, 4001, 4002, 4003, 4040],
				[4000, 4010, 4011, 4012, 4013],
				[4001, 4002, 4003, 4013, 4023],
				[4000, 4002, 4003, 4013, 4023],
				[4000, 4001, 4003, 4013, 4023],
				[4000, 4001, 4002, 4003, 4033],
				[4000, 4001, 4002, 4003, 4032],
				[4000, 4001, 4002, 4003, 4031],
				[4000, 4001, 4002, 4003, 4030],
				[4000, 4001, 4002, 4003, 4023],
				[4000, 4001, 4002, 4003, 4022],
				[4000, 4001, 4002, 4003, 4021],
				[4000, 4001, 4002, 4003, 4020],
				[4000, 4001, 4002, 4003, 4013],
				[4000, 4001, 4002, 4003, 4012],
				[4000, 4001, 4002, 4003, 4011],
				[4000, 4001, 4002, 4003, 4010],
			].filter((p) => p.includes(this.mandatoryId));

			const bestPack = {
				pack: packs[0],
				winRate: 0,
				countBattle: 0,
				id: 0,
			};

			for (const id in packs) {
				const pack = packs[id];
				const attackers = this.maxUpgrade.filter((e) => pack.includes(e.id)).reduce((obj, e) => ({ ...obj, [e.id]: e }), {});
				const battle = {
					attackers,
					defenders: [enemieHeroes],
					type: 'brawl_titan',
				};
				const isRandom = this.isRandomBattle(battle);
				const stat = {
					count: 0,
					win: 0,
					winRate: 0,
				};
				for (let i = 1; i <= 20; i++) {
					battle.seed = Math.floor(Date.now() / 1000) + Math.random() * 1000;
					const result = await Calc(battle);
					stat.win += result.result.win;
					stat.count += 1;
					stat.winRate = stat.win / stat.count;
					if (!isRandom || (i >= 2 && stat.winRate < 0.65) || (i >= 10 && stat.winRate == 1)) {
						break;
					}
				}

				if (!isRandom && stat.win) {
					return {
						favor: {},
						heroes: pack,
					};
				}
				if (stat.winRate > 0.85) {
					return {
						favor: {},
						heroes: pack,
					};
				}
				if (stat.winRate > bestPack.winRate) {
					bestPack.countBattle = stat.count;
					bestPack.winRate = stat.winRate;
					bestPack.pack = pack;
					bestPack.id = id;
				}
			}

			//console.log(bestPack.id, bestPack.pack, bestPack.winRate, bestPack.countBattle);
			return {
				favor: {},
				heroes: bestPack.pack,
			};
		}

		isRandomPack(pack) {
			const ids = Object.keys(pack);
			return ids.includes('4023') || ids.includes('4021');
		}

		isRandomBattle(battle) {
			return this.isRandomPack(battle.attackers) || this.isRandomPack(battle.defenders[0]);
		}

		async updateHeroesPack(enemieHeroes) {
			const packs = [{id:1,args:{userId:-830021,heroes:[63,13,9,48,1],pet:6006,favor:{1:6004,9:6005,13:6002,48:6e3,63:6009}},attackers:{1:{id:1,xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{2:130,3:130,4:130,5:130,6022:130,8268:1,8269:1},power:198058,star:6,runes:[43750,43750,43750,43750,43750],skins:{1:60,54:60,95:60,154:60,250:60,325:60},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6004,type:"hero",perks:[4,1],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,9,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,9,10]},agility:3093,hp:419649,intelligence:3644,physicalAttack:11481.6,strength:17049,armor:12720,dodge:17232.28,magicPenetration:22780,magicPower:55816,magicResist:1580,modifiedSkillTier:5,skin:0,favorPetId:6004,favorPower:11064},9:{id:9,xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{335:130,336:130,337:130,338:130,6027:130,8270:1,8271:1},power:195886,star:6,runes:[43750,43750,43750,43750,43750],skins:{9:60,41:60,163:60,189:60,311:60,338:60},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6005,type:"hero",perks:[7,2,20],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,9,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,9,10]},agility:3068,hp:227134,intelligence:19003,physicalAttack:7020.32,strength:3068,armor:19995,dodge:14644,magicPower:64780.6,magicResist:31597,modifiedSkillTier:5,skin:0,favorPetId:6005,favorPower:11064},13:{id:"13",xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{452:130,453:130,454:130,455:130,6012:130,8274:1,8275:1},power:194833,star:6,runes:[43750,43750,43750,43750,43750],skins:{13:60,38:60,148:60,199:60,240:60,335:60},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6002,type:"hero",perks:[7,2,21],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,9,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,9,10]},agility:2885,hp:344763,intelligence:17625,physicalAttack:50,strength:3020,armor:19060,magicPenetration:58138.6,magicPower:70100.6,magicResist:27227,modifiedSkillTier:4,skin:0,favorPetId:6002,favorPower:11064},48:{id:48,xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{240:130,241:130,242:130,243:130,6002:130},power:190584,star:6,runes:[43750,43750,43750,43750,43750],skins:{103:60,165:60,217:60,296:60,326:60},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6e3,type:"hero",perks:[5,2],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,10]},agility:17308,hp:397737,intelligence:2888,physicalAttack:40298.32,physicalCritChance:12280,strength:3169,armor:12185,armorPenetration:20137.6,magicResist:24816,skin:0,favorPetId:6e3,favorPower:11064},63:{id:63,xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{442:130,443:130,444:130,445:130,6041:130,8272:1,8273:1},power:193520,star:6,runes:[43750,43750,43750,43750,43750],skins:{341:60,350:60,351:60,352:1},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6009,type:"hero",perks:[6,1,21],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,9,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,9,10]},agility:17931,hp:488832,intelligence:2737,physicalAttack:54213.6,strength:2877,armor:800,armorPenetration:32477.6,magicResist:8526,physicalCritChance:9545,modifiedSkillTier:3,skin:0,favorPetId:6009,favorPower:11064},6006:{id:6006,color:10,star:6,xp:450551,level:130,slots:[25,50,50,25,50,50],skills:{6030:130,6031:130},power:181943,type:"pet",perks:[5,9],name:null,intelligence:11064,magicPenetration:47911,strength:12360}}},{id:2,args:{userId:-830049,heroes:[46,13,52,49,4],pet:6006,favor:{4:6001,13:6002,46:6006,49:6004,52:6003}},attackers:{4:{id:4,xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{255:130,256:130,257:130,258:130,6007:130},power:189782,star:6,runes:[43750,43750,43750,43750,43750],skins:{4:60,35:60,92:60,161:60,236:60},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6001,type:"hero",perks:[4,5,2,22],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,10]},agility:3065,hp:482631,intelligence:3402,physicalAttack:2800,strength:17488,armor:56262.6,magicPower:51021,magicResist:36971,skin:0,favorPetId:6001,favorPower:11064},13:{id:"13",xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{452:130,453:130,454:130,455:130,6012:130,8274:1,8275:1},power:194833,star:6,runes:[43750,43750,43750,43750,43750],skins:{13:60,38:60,148:60,199:60,240:60,335:60},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6002,type:"hero",perks:[7,2,21],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,9,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,9,10]},agility:2885,hp:344763,intelligence:17625,physicalAttack:50,strength:3020,armor:19060,magicPenetration:58138.6,magicPower:70100.6,magicResist:27227,modifiedSkillTier:4,skin:0,favorPetId:6002,favorPower:11064},46:{id:46,xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{230:130,231:130,232:130,233:130,6032:130},power:189653,star:6,runes:[43750,43750,43750,43750,43750],skins:{101:60,159:60,178:60,262:60,315:60},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6006,type:"hero",perks:[9,5,1,22],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,10]},agility:2122,hp:637517,intelligence:16208,physicalAttack:50,strength:5151,armor:38507.6,magicPower:74495.6,magicResist:22237,skin:0,favorPetId:6006,favorPower:11064},49:{id:49,xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{245:130,246:130,247:130,248:130,6022:130},power:193163,star:6,runes:[43750,43750,43750,43750,43750],skins:{104:60,191:60,252:60,305:60,329:60},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6004,type:"hero",perks:[10,1,22],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,10]},agility:17935,hp:250405,intelligence:2790,physicalAttack:40413.6,strength:2987,armor:11655,dodge:14844.28,magicResist:3175,physicalCritChance:14135,skin:0,favorPetId:6004,favorPower:11064},52:{id:52,xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{310:130,311:130,312:130,313:130,6017:130},power:185075,star:6,runes:[43750,43750,43750,43750,43750],skins:{188:60,213:60,248:60,297:60},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6003,type:"hero",perks:[5,8,2,13,15,22],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,10]},agility:18270,hp:226207,intelligence:2620,physicalAttack:44206,strength:3260,armor:13150,armorPenetration:40301,magicPower:9957.6,magicResist:33892.6,skin:0,favorPetId:6003,favorPower:11064},6006:{id:6006,color:10,star:6,xp:450551,level:130,slots:[25,50,50,25,50,50],skills:{6030:130,6031:130},power:181943,type:"pet",perks:[5,9],name:null,intelligence:11064,magicPenetration:47911,strength:12360}}},{id:3,args:{userId:8263225,heroes:[29,63,13,48,1],pet:6006,favor:{1:6004,13:6002,29:6006,48:6e3,63:6003}},attackers:{1:{id:1,xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{2:130,3:130,4:130,5:130,6022:130,8268:1,8269:1},power:198058,star:6,runes:[43750,43750,43750,43750,43750],skins:{1:60,54:60,95:60,154:60,250:60,325:60},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6004,type:"hero",perks:[4,1],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,9,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,9,10]},agility:3093,hp:419649,intelligence:3644,physicalAttack:11481.6,strength:17049,armor:12720,dodge:17232.28,magicPenetration:22780,magicPower:55816,magicResist:1580,modifiedSkillTier:5,skin:0,favorPetId:6004,favorPower:11064},13:{id:"13",xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{452:130,453:130,454:130,455:130,6012:130,8274:1,8275:1},power:194833,star:6,runes:[43750,43750,43750,43750,43750],skins:{13:60,38:60,148:60,199:60,240:60,335:60},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6002,type:"hero",perks:[7,2,21],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,9,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,9,10]},agility:2885,hp:344763,intelligence:17625,physicalAttack:50,strength:3020,armor:19060,magicPenetration:58138.6,magicPower:70100.6,magicResist:27227,modifiedSkillTier:4,skin:0,favorPetId:6002,favorPower:11064},29:{id:29,xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{145:130,146:130,147:130,148:130,6032:130},power:189790,star:6,runes:[43750,43750,43750,43750,43750],skins:{29:60,72:60,88:60,147:60,242:60},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6006,type:"hero",perks:[9,5,2,22],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,10]},agility:2885,hp:491431,intelligence:18331,physicalAttack:106,strength:3020,armor:37716.6,magicPower:76792.6,magicResist:31377,skin:0,favorPetId:6006,favorPower:11064},48:{id:48,xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{240:130,241:130,242:130,243:130,6002:130},power:190584,star:6,runes:[43750,43750,43750,43750,43750],skins:{103:60,165:60,217:60,296:60,326:60},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6e3,type:"hero",perks:[5,2],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,10]},agility:17308,hp:397737,intelligence:2888,physicalAttack:40298.32,physicalCritChance:12280,strength:3169,armor:12185,armorPenetration:20137.6,magicResist:24816,skin:0,favorPetId:6e3,favorPower:11064},63:{id:63,xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{442:130,443:130,444:130,445:130,6017:130,8272:1,8273:1},power:191031,star:6,runes:[43750,43750,43750,43750,43750],skins:{341:60,350:60,351:60,352:1},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6003,type:"hero",perks:[6,1,21],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,9,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,9,10]},agility:17931,hp:488832,intelligence:2737,physicalAttack:44256,strength:2877,armor:800,armorPenetration:22520,magicPower:9957.6,magicResist:18483.6,physicalCritChance:9545,modifiedSkillTier:3,skin:0,favorPetId:6003,favorPower:11064},6006:{id:6006,color:10,star:6,xp:450551,level:130,slots:[25,50,50,25,50,50],skills:{6030:130,6031:130},power:181943,type:"pet",perks:[5,9],name:null,intelligence:11064,magicPenetration:47911,strength:12360}}},{id:4,args:{userId:8263247,heroes:[55,13,40,51,1],pet:6006,favor:{1:6007,13:6002,40:6004,51:6006,55:6001}},attackers:{1:{id:1,xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{2:130,3:130,4:130,5:130,6035:130,8268:1,8269:1},power:195170,star:6,runes:[43750,43750,43750,43750,43750],skins:{1:60,54:60,95:60,154:60,250:60,325:60},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6007,type:"hero",perks:[4,1],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,9,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,9,10]},agility:3093,hp:419649,intelligence:3644,physicalAttack:1524,strength:17049,armor:22677.6,dodge:14245,magicPenetration:22780,magicPower:65773.6,magicResist:1580,modifiedSkillTier:5,skin:0,favorPetId:6007,favorPower:11064},13:{id:"13",xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{452:130,453:130,454:130,455:130,6012:130,8274:1,8275:1},power:194833,star:6,runes:[43750,43750,43750,43750,43750],skins:{13:60,38:60,148:60,199:60,240:60,335:60},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6002,type:"hero",perks:[7,2,21],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,9,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,9,10]},agility:2885,hp:344763,intelligence:17625,physicalAttack:50,strength:3020,armor:19060,magicPenetration:58138.6,magicPower:70100.6,magicResist:27227,modifiedSkillTier:4,skin:0,favorPetId:6002,favorPower:11064},40:{id:40,xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{200:130,201:130,202:130,203:130,6022:130,8244:1,8245:1},power:192541,star:6,runes:[43750,43750,43750,43750,43750],skins:{53:60,89:60,129:60,168:60,314:60},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6004,type:"hero",perks:[5,9,1],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,9,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,9,10]},agility:17540,hp:343191,intelligence:2805,physicalAttack:48430.6,strength:2976,armor:24410,dodge:15732.28,magicResist:17633,modifiedSkillTier:3,skin:0,favorPetId:6004,favorPower:11064},51:{id:51,xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{305:130,306:130,307:130,308:130,6032:130},power:190005,star:6,runes:[43750,43750,43750,43750,43750],skins:{181:60,219:60,260:60,290:60,334:60},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6006,type:"hero",perks:[5,9,1,12],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,10]},agility:2526,hp:438205,intelligence:18851,physicalAttack:50,strength:2921,armor:39442.6,magicPower:88978.6,magicResist:22960,skin:0,favorPetId:6006,favorPower:11064},55:{id:55,xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{325:130,326:130,327:130,328:130,6007:130},power:190529,star:6,runes:[43750,43750,43750,43750,43750],skins:{239:60,278:60,309:60,327:60,346:60},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6001,type:"hero",perks:[7,1],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,10]},agility:2631,hp:499591,intelligence:19438,physicalAttack:50,strength:3286,armor:32892.6,armorPenetration:36870,magicPower:60704,magicResist:10010,skin:0,favorPetId:6001,favorPower:11064},6006:{id:6006,color:10,star:6,xp:450551,level:130,slots:[25,50,50,25,50,50],skills:{6030:130,6031:130},power:181943,type:"pet",perks:[5,9],name:null,intelligence:11064,magicPenetration:47911,strength:12360}}},{id:5,args:{userId:8263303,heroes:[31,29,13,40,1],pet:6004,favor:{1:6001,13:6007,29:6002,31:6006,40:6004}},attackers:{1:{id:1,xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{2:130,3:130,4:130,5:130,6007:130,8268:1,8269:1},power:195170,star:6,runes:[43750,43750,43750,43750,43750],skins:{1:60,54:60,95:60,154:60,250:60,325:60},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6001,type:"hero",perks:[4,1],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,9,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,9,10]},agility:3093,hp:519225,intelligence:3644,physicalAttack:1524,strength:17049,armor:22677.6,dodge:14245,magicPenetration:22780,magicPower:55816,magicResist:1580,modifiedSkillTier:5,skin:0,favorPetId:6001,favorPower:11064},13:{id:"13",xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{452:130,453:130,454:130,455:130,6035:130,8274:1,8275:1},power:194833,star:6,runes:[43750,43750,43750,43750,43750],skins:{13:60,38:60,148:60,199:60,240:60,335:60},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6007,type:"hero",perks:[7,2,21],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,9,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,9,10]},agility:2885,hp:344763,intelligence:17625,physicalAttack:50,strength:3020,armor:29017.6,magicPenetration:48181,magicPower:70100.6,magicResist:27227,modifiedSkillTier:4,skin:0,favorPetId:6007,favorPower:11064},29:{id:29,xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{145:130,146:130,147:130,148:130,6012:130},power:189790,star:6,runes:[43750,43750,43750,43750,43750],skins:{29:60,72:60,88:60,147:60,242:60},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6002,type:"hero",perks:[9,5,2,22],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,10]},agility:2885,hp:491431,intelligence:18331,physicalAttack:106,strength:3020,armor:27759,magicPenetration:9957.6,magicPower:76792.6,magicResist:31377,skin:0,favorPetId:6002,favorPower:11064},31:{id:31,xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{155:130,156:130,157:130,158:130,6032:130},power:190305,star:6,runes:[43750,43750,43750,43750,43750],skins:{44:60,94:60,133:60,200:60,295:60},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6006,type:"hero",perks:[9,5,2,20],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,10]},agility:2781,dodge:12620,hp:374484,intelligence:18945,physicalAttack:78,strength:2916,armor:28049.6,magicPower:67686.6,magicResist:15252,skin:0,favorPetId:6006,favorPower:11064},40:{id:40,xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{200:130,201:130,202:130,203:130,6022:130,8244:1,8245:1},power:192541,star:6,runes:[43750,43750,43750,43750,43750],skins:{53:60,89:60,129:60,168:60,314:60},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6004,type:"hero",perks:[5,9,1],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,9,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,9,10]},agility:17540,hp:343191,intelligence:2805,physicalAttack:48430.6,strength:2976,armor:24410,dodge:15732.28,magicResist:17633,modifiedSkillTier:3,skin:0,favorPetId:6004,favorPower:11064},6004:{id:6004,color:10,star:6,xp:450551,level:130,slots:[25,50,50,25,50,50],skills:{6020:130,6021:130},power:181943,type:"pet",perks:[5],name:null,armorPenetration:47911,intelligence:11064,strength:12360}}},{id:6,args:{userId:8263317,heroes:[62,13,9,56,61],pet:6003,favor:{9:6004,13:6002,56:6006,61:6001,62:6003}},attackers:{9:{id:9,xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{335:130,336:130,337:130,338:130,6022:130,8270:1,8271:1},power:198525,star:6,runes:[43750,43750,43750,43750,43750],skins:{9:60,41:60,163:60,189:60,311:60,338:60},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6004,type:"hero",perks:[7,2,20],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,9,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,9,10]},agility:3068,hp:227134,intelligence:19003,physicalAttack:10007.6,strength:3068,armor:19995,dodge:17631.28,magicPower:54823,magicResist:31597,modifiedSkillTier:5,skin:0,favorPetId:6004,favorPower:11064},13:{id:"13",xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{452:130,453:130,454:130,455:130,6012:130,8274:1,8275:1},power:194833,star:6,runes:[43750,43750,43750,43750,43750],skins:{13:60,38:60,148:60,199:60,240:60,335:60},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6002,type:"hero",perks:[7,2,21],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,9,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,9,10]},agility:2885,hp:344763,intelligence:17625,physicalAttack:50,strength:3020,armor:19060,magicPenetration:58138.6,magicPower:70100.6,magicResist:27227,modifiedSkillTier:4,skin:0,favorPetId:6002,favorPower:11064},56:{id:56,xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{376:130,377:130,378:130,379:130,6032:130},power:184420,star:6,runes:[43750,43750,43750,43750,43750],skins:{264:60,279:60,294:60,321:60},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6006,type:"hero",perks:[5,7,1,21],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,10]},agility:2791,hp:235111,intelligence:18813,physicalAttack:50,strength:2656,armor:22982.6,magicPenetration:48159,magicPower:75598.6,magicResist:13990,skin:0,favorPetId:6006,favorPower:11064},61:{id:61,xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{411:130,412:130,413:130,414:130,6007:130},power:184868,star:6,runes:[43750,43750,43750,43750,43750],skins:{302:60,306:60,323:60,340:60},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6001,type:"hero",perks:[4,2,22],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,10]},agility:2545,hp:466176,intelligence:3320,physicalAttack:34305,strength:18309,armor:31077.6,magicResist:24101,physicalCritChance:9009,skin:0,favorPetId:6001,favorPower:11064},62:{id:62,xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{437:130,438:130,439:130,440:130,6017:130},power:173991,star:6,runes:[43750,43750,43750,43750,43750],skins:{320:60,343:60},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6003,type:"hero",perks:[8,7,2,22],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,10]},agility:2530,hp:276010,intelligence:19245,physicalAttack:50,strength:3543,armor:12890,magicPenetration:23658,magicPower:80966.6,magicResist:12447.6,skin:0,favorPetId:6003,favorPower:11064},6003:{id:6003,color:10,star:6,xp:450551,level:130,slots:[25,50,50,25,50,50],skills:{6015:130,6016:130},power:181943,type:"pet",perks:[8],name:null,intelligence:11064,magicPenetration:47911,strength:12360}}},{id:7,args:{userId:8263335,heroes:[32,29,13,43,1],pet:6006,favor:{1:6004,13:6008,29:6006,32:6002,43:6007}},attackers:{1:{id:1,xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{2:130,3:130,4:130,5:130,6022:130,8268:1,8269:1},power:198058,star:6,runes:[43750,43750,43750,43750,43750],skins:{1:60,54:60,95:60,154:60,250:60,325:60},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6004,type:"hero",perks:[4,1],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,9,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,9,10]},agility:3093,hp:419649,intelligence:3644,physicalAttack:11481.6,strength:17049,armor:12720,dodge:17232.28,magicPenetration:22780,magicPower:55816,magicResist:1580,modifiedSkillTier:5,skin:0,favorPetId:6004,favorPower:11064},13:{id:"13",xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{452:130,453:130,454:130,455:130,6038:130,8274:1,8275:1},power:194833,star:6,runes:[43750,43750,43750,43750,43750],skins:{13:60,38:60,148:60,199:60,240:60,335:60},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6008,type:"hero",perks:[7,2,21],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,9,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,9,10]},agility:2885,hp:344763,intelligence:17625,physicalAttack:50,strength:3020,armor:29017.6,magicPenetration:48181,magicPower:70100.6,magicResist:27227,modifiedSkillTier:4,skin:0,favorPetId:6008,favorPower:11064},29:{id:29,xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{145:130,146:130,147:130,148:130,6032:130},power:189790,star:6,runes:[43750,43750,43750,43750,43750],skins:{29:60,72:60,88:60,147:60,242:60},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6006,type:"hero",perks:[9,5,2,22],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,10]},agility:2885,hp:491431,intelligence:18331,physicalAttack:106,strength:3020,armor:37716.6,magicPower:76792.6,magicResist:31377,skin:0,favorPetId:6006,favorPower:11064},32:{id:32,xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{160:130,161:130,162:130,163:130,6012:130},power:189956,star:6,runes:[43750,43750,43750,43750,43750],skins:{45:60,73:60,81:60,135:60,212:60},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6002,type:"hero",perks:[7,5,2,22],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,10]},agility:2815,hp:551066,intelligence:18800,physicalAttack:50,strength:2810,armor:19040,magicPenetration:9957.6,magicPower:89495.6,magicResist:20805,skin:0,favorPetId:6002,favorPower:11064},43:{id:43,xp:3625195,level:130,color:18,slots:[0,0,0,0,0,0],skills:{215:130,216:130,217:130,218:130,6035:130},power:189593,star:6,runes:[43750,43750,43750,43750,43750],skins:{98:60,130:60,169:60,201:60,304:60},currentSkin:0,titanGiftLevel:30,titanCoinsSpent:null,artifacts:[{level:130,star:6},{level:130,star:6},{level:130,star:6}],scale:1,petId:6007,type:"hero",perks:[7,9,1,21],ascensions:{1:[0,1,2,3,4,5,6,7,8,9],2:[0,1,2,3,4,5,6,7,8,10],3:[0,1,2,3,4,5,6,7,8,9],4:[0,1,2,3,4,5,6,7,8,9],5:[0,1,2,3,4,5,6,7,8,10]},agility:2447,hp:265217,intelligence:18758,physicalAttack:50,strength:2842,armor:18637.6,magicPenetration:52439,magicPower:75465.6,magicResist:22695,skin:0,favorPetId:6007,favorPower:11064},6006:{id:6006,color:10,star:6,xp:450551,level:130,slots:[25,50,50,25,50,50],skills:{6030:130,6031:130},power:181943,type:"pet",perks:[5,9],name:null,intelligence:11064,magicPenetration:47911,strength:12360}}}];

			const bestPack = {
				pack: packs[0],
				countWin: 0,
			}

			for (const pack of packs) {
				const attackers = pack.attackers;
				const battle = {
					attackers,
					defenders: [enemieHeroes],
					type: 'brawl',
				};

				let countWinBattles = 0;
				let countTestBattle = 10;
				for (let i = 0; i < countTestBattle; i++) {
					battle.seed = Math.floor(Date.now() / 1000) + Math.random() * 1000;
					const result = await Calc(battle);
					if (result.result.win) {
						countWinBattles++;
					}
					if (countWinBattles > 7) {
						console.log(pack)
						return pack.args;
					}
				}
				if (countWinBattles > bestPack.countWin) {
					bestPack.countWin = countWinBattles;
					bestPack.pack = pack.args;
				}
			}

			console.log(bestPack);
			return bestPack.pack;
		}

		async questFarm() {
			const calls = [this.callBrawlQuestFarm];
			const result = await Send(JSON.stringify({ calls }));
			return result.results[0].result.response;
		}

		async getBrawlInfo() {
			const data = await Send(JSON.stringify({
				calls: [
					this.callUserGetInfo,
					this.callBrawlQuestGetInfo,
					this.callBrawlFindEnemies,
					this.callTeamGetMaxUpgrade,
					this.callBrawlGetInfo,
				]
			}));

			let attempts = data.results[0].result.response.refillable.find(n => n.id == 48);

			const maxUpgrade = data.results[3].result.response;
			const maxHero = Object.values(maxUpgrade.hero);
			const maxTitan = Object.values(maxUpgrade.titan);
			const maxPet = Object.values(maxUpgrade.pet);
			this.maxUpgrade = [...maxHero, ...maxPet, ...maxTitan];

			this.info = data.results[4].result.response;
			this.mandatoryId = lib.data.brawl.promoHero[this.info.id].promoHero;
			return {
				attempts: attempts.amount,
				questInfo: data.results[1].result.response,
				findEnemies: data.results[2].result.response,
			}
		}

		/**
		 * Carrying out a fight
		 *
		 * Проведение боя
		 */
		async battle(userId) {
			this.stats.count++;
			const battle = await this.startBattle(userId, this.args);
			const result = await Calc(battle);
			console.log(result.result);
			if (result.result.win) {
				this.stats.win++;
			} else {
				this.stats.loss++;
				if (!this.info.boughtEndlessLivesToday) {
					this.attempts--;
				}
			}
			return await this.endBattle(result);
			// return await this.cancelBattle(result);
		}

		/**
		 * Starts a fight
		 *
		 * Начинает бой
		 */
		async startBattle(userId, args) {
			const call = {
				name: "brawl_startBattle",
				args,
				ident: "brawl_startBattle"
			}
			call.args.userId = userId;
			const calls = [call];
			const result = await Send(JSON.stringify({ calls }));
			return result.results[0].result.response;
		}

		cancelBattle(battle) {
			const fixBattle = function (heroes) {
				for (const ids in heroes) {
					const hero = heroes[ids];
					hero.energy = random(1, 999);
					if (hero.hp > 0) {
						hero.hp = random(1, hero.hp);
					}
				}
			}
			fixBattle(battle.progress[0].attackers.heroes);
			fixBattle(battle.progress[0].defenders.heroes);
			return this.endBattle(battle);
		}

		/**
		 * Ends the fight
		 *
		 * Заканчивает бой
		 */
		async endBattle(battle) {
			battle.progress[0].attackers.input = ['auto', 0, 0, 'auto', 0, 0];
			const calls = [{
				name: "brawl_endBattle",
				args: {
					result: battle.result,
					progress: battle.progress
				},
				ident: "brawl_endBattle"
			},
			this.callBrawlQuestGetInfo,
			this.callBrawlFindEnemies,
			];
			const result = await Send(JSON.stringify({ calls }));
			return result.results;
		}

		end(endReason) {
			const { executeBrawls } = HWHClasses;
			setIsCancalBattle(true);
			executeBrawls.isBrawlsAutoStart = false;
			setProgress(endReason, true);
			console.log(endReason);
			this.resolve();
		}
	}

	this.HWHClasses.executeBrawls = executeBrawls;

	/**
	 * Runs missions from the company on a specified list
	 * Выполняет миссии из компании по списку
	 * @param {Array} missions [{id: 25, times: 3}, {id: 45, times: 30}]
	 * @param {Boolean} isRaids выполнять миссии рейдом
	 * @returns
	 */
	function testCompany(missions, isRaids = false) {
		const { ExecuteCompany } = HWHClasses;
		return new Promise((resolve, reject) => {
			const tower = new ExecuteCompany(resolve, reject);
			tower.start(missions, isRaids);
		});
	}

	/**
	 * Fulfilling company missions
	 * Выполнение миссий компании
	 */
	class ExecuteCompany {
		constructor(resolve, reject) {
			this.resolve = resolve;
			this.reject = reject;
			this.missionsIds = [];
			this.currentNum = 0;
			this.isRaid = false;
			this.currentTimes = 0;

			this.argsMission = {
				id: 0,
				heroes: [],
				favor: {},
			};
		}

		async start(missionIds, isRaids) {
			this.missionsIds = missionIds;
			this.isRaid = isRaids;
			const data = await Caller.send(['teamGetAll', 'teamGetFavor']);
			this.startCompany(data);
		}

		startCompany(data) {
			const [teamGetAll, teamGetFavor] = data;

			this.argsMission.heroes = teamGetAll.mission.filter((id) => id < 6000);
			this.argsMission.favor = teamGetFavor.mission;

			const pet = teamGetAll.mission.filter((id) => id >= 6000).pop();
			if (pet) {
				this.argsMission.pet = pet;
			}

			this.checkStat();
		}

		checkStat() {
			if (!this.missionsIds[this.currentNum].times) {
				this.currentNum++;
			}

			if (this.currentNum === this.missionsIds.length) {
				this.endCompany('EndCompany');
				return;
			}

			this.argsMission.id = this.missionsIds[this.currentNum].id;
			this.currentTimes = this.missionsIds[this.currentNum].times;
			setProgress('Сompany: ' + this.argsMission.id + ' - ' + this.currentTimes, false);
			if (this.isRaid) {
				this.missionRaid();
			} else {
				this.missionStart();
			}
		}

		async missionRaid() {
			try {
				await Caller.send({
					name: 'missionRaid',
					args: {
						id: this.argsMission.id,
						times: this.currentTimes,
					},
				});
			} catch (error) {
				console.warn(error);
			}

			this.missionsIds[this.currentNum].times = 0;
			this.checkStat();
		}

		async missionStart() {
			this.lastMissionBattleStart = Date.now();
			let result = null;
			try {
				result = await Caller.send({
					name: 'missionStart',
					args: this.argsMission,
				});
			} catch (error) {
				console.warn(error);
				this.endCompany('missionStartError', error['error']);
				return;
			}
			this.missionEnd(await Calc(result));
		}

		async missionEnd(r) {
			const timer = r.battleTimer;
			await countdownTimer(timer, 'Сompany: ' + this.argsMission.id + ' - ' + this.currentTimes);

			try {
				await Caller.send({
					name: 'missionEnd',
					args: {
						id: this.argsMission.id,
						result: r.result,
						progress: r.progress,
					},
				});
			} catch (error) {
				this.endCompany('missionEndError', error);
				return;
			}

			this.missionsIds[this.currentNum].times--;
			this.checkStat();
		}

		endCompany(reason, info) {
			setProgress('Сompany completed!', true);
			console.log(reason, info);
			this.resolve();
		}
	}

	this.HWHClasses.ExecuteCompany = ExecuteCompany;
	})();

	/**
	 * TODO:
	 * Закрытие окошек по Esc +-
	 * Починить работу скрипта на уровне команды ниже 10 +-
	 * Написать номальную синхронизацию
	 */

