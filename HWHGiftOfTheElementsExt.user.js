// ==UserScript==
// @name            HWHGiftOfTheElementsExt
// @name:en         HWHGiftOfTheElementsExt
// @name:ru         HWHGiftOfTheElementsExt
// @namespace       HWHGiftOfTheElementsExt
// @version         3.9.9
// @description     Extension for HeroWarsHelper script
// @description:en  Extension for HeroWarsHelper script
// @description:ru  Расширение для скрипта HeroWarsHelper
// @author          Green
// @license         Copyright Green
// @icon            https://i.ibb.co/xtmhK7zS/icon.png
// @match           https://www.hero-wars.com/*
// @match           https://apps-1701433570146040.apps.fbsbx.com/*
// @grant           none
// @run-at          document-end
// @downloadURL https://github.com/mailming/AutoHero/raw/refs/heads/develop/HWHGiftOfTheElementsExt.user.js
// @updateURL https://github.com/mailming/AutoHero/raw/refs/heads/develop/HWHGiftOfTheElementsExt.user.js
// ==/UserScript==

(function () {
	if (!this.HWHClasses) {
		console.log('%cObject for extension not found', 'color: red');
		return;
	}

	console.log('%cStart Extension ' + GM_info.script.name + ', v' + GM_info.script.version + ' by ' + GM_info.script.author, 'color: red');
	const { addExtentionName } = HWHFuncs;
	addExtentionName(GM_info.script.name, GM_info.script.version, GM_info.script.author);

	const { popup, confShow, setProgress, hideProgress } = HWHFuncs;
	const { i18nLangData } = HWHData;

	// Constants
	const POWER_LEVEL = [22, 22, 22, 22, 22, 66, 66, 66, 66, 66, 110, 110, 110, 110, 110, 154,
		154, 154, 154, 154, 198, 198, 198, 198, 198, 242, 242, 242, 242, 242];
	const MAX_TITAN_GIFT_LEVEL = 30;
	const MIN_USER_LEVEL = 30;
	const CONSUMABLE_ID_TITAN_GIFT = 24;
	const QUEST_COLLECTION_MAX_ITERATIONS = 50;
	const QUEST_COLLECTION_DELAY = 100;
	const QUEST_ID_FILTER_THRESHOLD = 1780000000;
	const AUTO_EXECUTION_TIMEOUT = 100;
	const AUTO_EXECUTION_DELAY = 3000;

	const i18nLangDataEn = {
		GIFT_OF_ELEMENTS: 'Gift of the Elements',
		GIFT_OF_ELEMENTS_TITLE: 'Spend "Sparks of Power" or Reset "Gifts of the Elements"',
		GOE_SPEND_SPARKS_OF_POWER: 'Spend "Sparks of Power"',
		GOE_SPEND_SPARKS_OF_POWER_TITLE: 'Spend "Sparks of Power"',
		GOE_RESET_GIFTS: 'Reset "Gifts of the Elements"',
		GOE_RESET_GIFTS_LIGHT: 'Reset "Gifts of the Elements" <br> <span style="color: aqua;"> level 1 - 29 </span>',
		GOE_RESET_GIFTS_LIGHT_TITLE: 'Reset "Gifts of the Elements". You can\'t reset Gift of the Elements level 30.',
		GOE_RESET_GIFTS_EXTREME: 'Reset "Gifts of the Elements" <span style="color: red;"> level 30 </span>',
		GOE_RESET_GIFTS_EXTREME_TITLE: 'Reset "Gifts of the Elements". There is no limit to the level of the Gift of Elements.',
		GOE_SELECT_ACTION: 'Select an action',
		GOE_NOTHING_TO_IMPROVE_LVL30: 'Nothing to improve. Account hasn\'t reached team level 30',
		GOE_NOTHING_TO_IMPROVE: 'Nothing to improve. All heroes have maximum elemental gift level',
		GOE_SPEND_SPARKS_OF_POWER_MESSAGE:
			'Available <span style="color: green;"> {titanGift} </span> sparks of power <br> Specify how many sparks of power need to be spent',
		GOE_INCORRECT_VALUE: 'Incorrect value',
		GOE_IMPROVING_START: 'Improving the Gift of the Elements...',
		GOE_NOT_ENOUGH_RESOURCES: 'Not enough gold or sparks of power',
		GOE_ALL_HEROES_HAVE_30LVL: '<br>All heroes have reached level 30 in Gifts of the Elements',
		GOE_GOLD_IS_GONE: '<br><span style="color: red;"> The gold is gone </span>',
		GOE_PROGRESS_OF_IMPROVEMENT_MESSAGE: 'Gift of the Elements has been upgraded to level <span style="color: green;"> {titanGiftLevel} </span>',
		GOE_RESULT_OF_IMPROVEMENT: 'Gift of the Elements has been upgraded <span style="color: green;"> {counter} </span> time(s)',
		GOE_NOTHING_TO_RESET: 'Nothing to reset',
		GOE_IMPOSSIBLE_TO_RESET: 'You don\'t have any heroes with Elemental Gift below level 30',
		GOE_RESET_GIFTS_LIGHT_MESSAGE:
			`Specify the <span style="color:red;"> maximum </span> reset level for Gift of the Elements
            <br> Range: <span style="color:green;"> 1 </span> to <span style="color:green;"> 29 </span>`,
		GOE_RESULT_RESET_GIFTS: 'Gift of the Elements has been reset for <span style="color: green;"> {counter} </span> hero(es)',
		GOE_RESET_GIFTS_EXTREME_MESSAGE:
			`You have <span style="color:green;"> {level30} </span> hero(es) with level <span style="color:green;">30</span> Gift of the Elements
            <br> Enter how many level <span style="color:green;">30</span> Gifts of the Elements to reset
            <br> <span style="color:red;"> The reset will start with the weakest hero </span> <br> Gifts of the Elements of lower levels will be reset automatically`,
		GOE_EXTREME_DO_NOT_HAVE_HERO_30LVL:
			'You don\'t have any heroes with Gift of the Elements level 30 <br> Reset Gifts of the Elements to a lower level?',
		GOE_EXTREME_RESULT_RESET_GIFTS:
			'<br> <span style="color: green;"> {counter30} </span> of them are level <span style="color:green;">30</span>',
		GOE_GET_POWER: 'Get power',
		GOE_GET_POWER_TITLE: 'Increase the overall power of heroes by the specified amount',
		GOE_GET_POWER_MESSAGE:
			`By spending sparks of power and gold you can get а maximum <span style="color: green;"> {maxHeroPawer} </span> units of hero power
            <br> Specify how much hero power you want to get`,
		GOE_GOT_POWER: '<br> Received <span style="color: green;"> {gotPower} </span> hero power',
		GOE_NOT_ENOUGH_GOLD:
			`<br><br><span style="color: red;">Not enough gold</span> to get all available hero power
            <br> Heve gold: <span style="color: green;">{haveGold} </span> <br> Gold needed: <span style="color: red;"> {goldIsNeeded} </span>`,
		GOE_AUTO_GET_POWER: 'Auto Get Power',
		GOE_AUTO_GET_POWER_TITLE: 'Automatically get power when script loads',
		GOE_AUTO_GET_POWER_AMOUNT: 'Auto Get Power Amount & Collect Rewards',
		GOE_AUTO_GET_POWER_AMOUNT_TITLE: 'Amount of power to get automatically (0 = disabled)',
		GOE_COLLECT_QUEST_REWARDS: 'Collect All Quest Rewards',
		GOE_COLLECT_QUEST_REWARDS_TITLE: 'Manually collect all available quest rewards',
	};

	i18nLangData['en'] = Object.assign(i18nLangData['en'], i18nLangDataEn);

	const i18nLangDataRu = {
		GIFT_OF_ELEMENTS: 'Дар стихий',
		GIFT_OF_ELEMENTS_TITLE: 'Потратить "Искры мощи" или Сбросить "Дары стихий"',
		GOE_SPEND_SPARKS_OF_POWER: 'Потратить "Искры мощи"',
		GOE_SPEND_SPARKS_OF_POWER_TITLE: 'Потратить "Искры мощи"',
		GOE_RESET_GIFTS: 'Сбросить "Дары стихий"',
		GOE_RESET_GIFTS_LIGHT: 'Сбросить "Дары стихий" <br> <span style="color: aqua;"> 1 - 29 уровня </span>',
		GOE_RESET_GIFTS_LIGHT_TITLE: 'Сбросить "Дары стихий". Не сбрасывается 30 уровень дара стихий',
		GOE_RESET_GIFTS_EXTREME: 'Сбросить "Дары стихий" <span style="color: red;"> 30 уровня </span>',
		GOE_RESET_GIFTS_EXTREME_TITLE: 'Сбросить "Дары стихий". Нет ограничений уровня дара стихий',
		GOE_SELECT_ACTION: 'Выберите действие',
		GOE_NOTHING_TO_IMPROVE_LVL30: 'Нечего улучшать. Аккаунт не достиг 30 уровня команды',
		GOE_NOTHING_TO_IMPROVE: 'Нечего улучшать. У всех героев максимальный уровень дара стихий',
		GOE_SPEND_SPARKS_OF_POWER_MESSAGE:
			'Доступно <span style="color: green;"> {titanGift} </span> искр мощи <br> Укажите сколько искр мощи потратить',
		GOE_INCORRECT_VALUE: 'Некорректное значение',
		GOE_IMPROVING_START: 'Улучшаем дар стихий...',
		GOE_NOT_ENOUGH_RESOURCES: 'Недостаточно золота или искр мощи',
		GOE_ALL_HEROES_HAVE_30LVL: '<br>Достигнут 30 уровень дара стихий у всех героев',
		GOE_GOLD_IS_GONE: '<br><span style="color: red;"> Закончилось золото </span>',
		GOE_PROGRESS_OF_IMPROVEMENT_MESSAGE: 'Дар стихий улучшен до <span style="color: green;"> {titanGiftLevel} </span> уровня',
		GOE_RESULT_OF_IMPROVEMENT: 'Дар стихий улучшен <span style="color: green;"> {counter} </span> раз(а)',
		GOE_NOTHING_TO_RESET: 'Нечего сбрасывать',
		GOE_IMPOSSIBLE_TO_RESET: 'Нет героев с даром стихий меньше 30 уровня',
		GOE_RESET_GIFTS_LIGHT_MESSAGE:
			`Укажите <span style="color:red;"> максимальный </span> сбрасываемый уровень дара стихий
            <br> Диапазон от <span style="color: green;"> 1 </span> до <span style="color: green;"> 29 </span>`,
		GOE_RESULT_RESET_GIFTS: 'Дар стихий сброшен у <span style="color: green;"> {counter} </span> героев(я)',
		GOE_RESET_GIFTS_EXTREME_MESSAGE:
			`У Вас <span style="color:green;"> {level30} </span> героя(ев) с <span style="color:green;">30</span> уровнем дара стихий
            <br> Укажите сколько даров стихий <span style="color:green;">30</span> уровня сбросить
            <br> <span style="color:red;"> Сброс начнется с самого слабого героя </span> <br> Дары стихий меньших уровней будут сброшены автоматически`,
		GOE_EXTREME_DO_NOT_HAVE_HERO_30LVL:
			'У Вас нет героев с 30 уровнем дара стихий <br> Сбросить дары стихий меньшего уровня?',
		GOE_EXTREME_RESULT_RESET_GIFTS:
			'<br> <span style="color: green;"> {counter30} </span> из них <span style="color:green;">30</span> уровня',
		GOE_GET_POWER: 'Увеличить мощь',
		GOE_GET_POWER_TITLE: 'Увеличить общую мощи героев на указанное количество',
		GOE_GET_POWER_MESSAGE:
			`Потратив искры мощи и золото, вы можете получить максимум <span style="color: green;"> {maxHeroPawer} </span> единиц мощи героев
            <br> Укажите, сколько мощи героев необходимо получить`,
		GOE_GOT_POWER: '<br> Получили мощи героев: <span style="color: green;"> {gotPower} </span>',
		GOE_NOT_ENOUGH_GOLD:
			`<br><br><span style="color: red;">Не достаточно золота</span>, чтобы получить всю доступную мощь героев
			<br> Имеем золота: <span style="color: green;">{haveGold}</span> <br> Необходимо золота: <span style="color: red;"> {goldIsNeeded} </span>`,
		GOE_AUTO_GET_POWER: 'Авто получение мощи',
		GOE_AUTO_GET_POWER_TITLE: 'Автоматически получать мощь при загрузке скрипта',
		GOE_AUTO_GET_POWER_AMOUNT: 'Количество мощи для авто получения',
		GOE_AUTO_GET_POWER_AMOUNT_TITLE: 'Количество мощи для автоматического получения (0 = отключено)',
		GOE_COLLECT_QUEST_REWARDS: 'Собрать все награды за квесты',
		GOE_COLLECT_QUEST_REWARDS_TITLE: 'Вручную собрать все доступные награды за квесты',
	};

	i18nLangData['ru'] = Object.assign(i18nLangData['ru'], i18nLangDataRu);

	// Settings
	const { checkboxes, inputs } = HWHData;
	checkboxes.autoGetPower = {
		get label() {
			return I18N('GOE_AUTO_GET_POWER');
		},
		cbox: null,
		get title() {
			return I18N('GOE_AUTO_GET_POWER_TITLE');
		},
		default: false,
	};
	inputs.autoGetPowerAmount = {
		get title() {
			return I18N('GOE_AUTO_GET_POWER_AMOUNT');
		},
		default: 0,
	};

	// Fix: Allow input of 0 in autoGetPowerAmount field
	const fixInputValidation = setInterval(() => {
		const { inputs } = HWHData;
		if (inputs.autoGetPowerAmount?.input && HWHFuncs) {
			clearInterval(fixInputValidation);
			
			const input = inputs.autoGetPowerAmount.input;
			const inputName = 'autoGetPowerAmount';
			let userEnteredValue = null;
			
			input.addEventListener('input', function () {
				const rawValue = this.value;
				const numValue = +rawValue;
				if (rawValue === '' || !Number.isNaN(numValue)) {
					userEnteredValue = rawValue === '' ? null : numValue;
				}
			}, true);
			
			input.addEventListener('input', function () {
				setTimeout(() => {
					const numValue = +this.value;
					if (userEnteredValue === 0 && numValue !== 0) {
						this.value = 0;
						HWHFuncs.setSaveVal?.(inputName, 0);
					} else if (userEnteredValue !== null && !Number.isNaN(userEnteredValue) && numValue !== userEnteredValue) {
						this.value = userEnteredValue;
						HWHFuncs.setSaveVal?.(inputName, userEnteredValue);
					}
				}, 0);
			}, false);
			
			input.addEventListener('blur', function () {
				const numValue = +this.value;
				if (!Number.isNaN(numValue)) {
					HWHFuncs.setSaveVal?.(inputName, numValue);
					if (numValue === 0) {
						this.value = 0;
					}
				}
			});
			
			console.log(`%c${GM_info.script.name}: Fixed input validation to allow 0`, 'color: green');
		}
	}, 200);

	// Menu buttons
	const { othersPopupButtons } = HWHData;
	othersPopupButtons.push({
		get msg() {
			return I18N('GIFT_OF_ELEMENTS');
		},
		get title() {
			return I18N('GIFT_OF_ELEMENTS_TITLE');
		},
		result: async function () {
			await onClickGiftOfTheElements();
		},
		color: 'pink',
	});

	async function onClickGiftOfTheElements() {
		const popupButtons = [
			{
				get msg() {
					return I18N('GOE_SPEND_SPARKS_OF_POWER');
				},
				get title() {
					return I18N('GOE_SPEND_SPARKS_OF_POWER_TITLE');
				},
				result: async function () {
					await spendSparksPower();
				},
				color: 'green',
			},
			{
				get msg() {
					return I18N('GOE_GET_POWER');
				},
				get title() {
					return I18N('GOE_GET_POWER_TITLE');
				},
				result: async function () {
					await getPower();
				},
				color: 'green',
			},
			{
				get msg() {
					return I18N('GOE_COLLECT_QUEST_REWARDS');
				},
				get title() {
					return I18N('GOE_COLLECT_QUEST_REWARDS_TITLE');
				},
				result: async function () {
					await collectAllQuestRewards();
				},
				color: 'blue',
			},
			{
				get msg() {
					return I18N('GOE_RESET_GIFTS_LIGHT');
				},
				get title() {
					return I18N('GOE_RESET_GIFTS_LIGHT_TITLE');
				},
				result: async function () {
					await resetTitanGifts();
				},
			},
			{
				get msg() {
					return I18N('GOE_RESET_GIFTS_EXTREME');
				},
				get title() {
					return I18N('GOE_RESET_GIFTS_EXTREME_TITLE');
				},
				result: async function () {
					await resetTitanGifts30LVL();
				},
			},
		];
		popupButtons.push({ result: false, isClose: true });
		const answer = await popup.confirm(`${I18N('GOE_SELECT_ACTION')}`, popupButtons);
		if (typeof answer === 'function') {
			answer();
		}
	}

	// Helper: Validate user level and titan gift level
	function validateUpgradeConditions(userLevel, minTitanGiftLevel, isAutoMode = false) {
		if (userLevel < MIN_USER_LEVEL) {
			if (!isAutoMode) {
				confShow(`${I18N('GOE_NOTHING_TO_IMPROVE_LVL30')}`);
			}
			return false;
		}
		if (minTitanGiftLevel === MAX_TITAN_GIFT_LEVEL) {
			if (!isAutoMode) {
				confShow(`${I18N('GOE_NOTHING_TO_IMPROVE')}`);
			}
			return false;
		}
		return true;
	}

	// Helper: Calculate maximum possible power
	function findMaximumPossiblePower(heroes, titanGift, titanGiftLib) {
		const result = { maximumPowerWeCanGet: 0, needGoldToGetMaxPower: 0 };
		let remainingTitanGift = titanGift;

		for (let tGiftLvl = heroes[0].titanGiftLevel; tGiftLvl < MAX_TITAN_GIFT_LEVEL; tGiftLvl++) {
			for (const hero of heroes) {
				if (hero.titanGiftLevel > tGiftLvl) {
					continue;
				}
				const nextLevelCost = titanGiftLib[tGiftLvl + 1].cost;
				if (remainingTitanGift < nextLevelCost.consumable[CONSUMABLE_ID_TITAN_GIFT]) {
					return result;
				}
				remainingTitanGift -= nextLevelCost.consumable[CONSUMABLE_ID_TITAN_GIFT];
				result.maximumPowerWeCanGet += POWER_LEVEL[tGiftLvl];
				result.needGoldToGetMaxPower += nextLevelCost.gold;
			}
		}
		return result;
	}

	// Core upgrade logic (shared between getPower and spendSparksPower)
	async function upgradeTitanGifts(options) {
		const {
			targetPower = null,
			targetTitanGift = null,
			isAutoMode = false,
			showProgress = true,
		} = options;

		const [heroGetAll, inventory, user] = await new Caller(['heroGetAll', 'inventoryGet', 'userGetInfo']).execute();
		let heroes = Object.values(heroGetAll).sort((a, b) => a.titanGiftLevel - b.titanGiftLevel);
		const heroSumPowerStart = Object.values(heroGetAll).reduce((a, e) => a + e.power, 0);
		const titanGiftLib = lib.getData('titanGift');
		let titanGift = inventory.consumable[CONSUMABLE_ID_TITAN_GIFT];
		const titanGiftMax = titanGift;
		let gold = user.gold;
		const userLevel = user.level;
		const minTitanGiftLevel = heroes[0].titanGiftLevel;

		if (!validateUpgradeConditions(userLevel, minTitanGiftLevel, isAutoMode)) {
			return;
		}

		// Determine target (power or titan gift amount)
		let targetTitanGiftAmount = null;
		let targetHeroPower = null;

		if (targetPower !== null) {
			targetHeroPower = targetPower;
			const result = findMaximumPossiblePower(heroes, titanGift, titanGiftLib);
			if (targetHeroPower > result.maximumPowerWeCanGet) {
				if (!isAutoMode) {
					confShow(`${I18N('GOE_INCORRECT_VALUE')}`);
				}
				return;
			}
		} else if (targetTitanGift !== null) {
			targetTitanGiftAmount = targetTitanGift;
			if (targetTitanGiftAmount > titanGiftMax || targetTitanGiftAmount < 0) {
				if (!isAutoMode) {
					confShow(`${I18N('GOE_INCORRECT_VALUE')}`);
				}
				return;
			}
			titanGift = targetTitanGiftAmount;
		}

		let calls = [];
		let titanGiftLevel = minTitanGiftLevel;
		let titanGiftUpgradeCounter = 0;
		let message = '';
		let gotHeroPower = 0;

		if (showProgress) {
			setProgress(I18N('GOE_IMPROVING_START'), false);
		}

		let cycle = true;
		while (cycle) {
			for (const hero of heroes) {
				if (titanGiftLevel >= MAX_TITAN_GIFT_LEVEL) {
					message += I18N('GOE_ALL_HEROES_HAVE_30LVL');
					cycle = false;
					break;
				}
				if (hero.titanGiftLevel > titanGiftLevel) {
					break;
				}
				const nextLevelCost = titanGiftLib[hero.titanGiftLevel + 1].cost;
				const costTitanGift = nextLevelCost.consumable[CONSUMABLE_ID_TITAN_GIFT];

				if (titanGift < costTitanGift || gold < nextLevelCost.gold) {
					if (titanGiftUpgradeCounter === 0 && calls.length === 0) {
						if (showProgress) {
							setProgress('', true);
						}
						if (!isAutoMode) {
							confShow(`${I18N('GOE_NOT_ENOUGH_RESOURCES')}`);
						}
						return;
					}
					if (gold < nextLevelCost.gold) {
						message += I18N('GOE_GOLD_IS_GONE');
					}
					cycle = false;
					break;
				}

				// Check if we've reached our target
				if (targetHeroPower !== null) {
					gotHeroPower += POWER_LEVEL[hero.titanGiftLevel];
					if (gotHeroPower >= targetHeroPower) {
						cycle = false;
						break;
					}
				}

				calls.push({ name: 'heroTitanGiftLevelUp', args: { heroId: hero.id } });
				titanGift -= costTitanGift;
				gold -= nextLevelCost.gold;

				// Check if we've spent enough titan gift
				if (targetTitanGiftAmount !== null && titanGift <= 0) {
					cycle = false;
					break;
				}
			}

			if (calls.length > 0) {
				await Caller.send(calls);
				titanGiftUpgradeCounter += calls.length;
				heroGetAll = await new Caller('heroGetAll').execute();
				heroes = Object.values(heroGetAll).sort((a, b) => a.titanGiftLevel - b.titanGiftLevel);
				calls = [];
				titanGiftLevel++;
				if (showProgress) {
					setProgress(I18N('GOE_PROGRESS_OF_IMPROVEMENT_MESSAGE', { titanGiftLevel }), false);
				}
			}
		}

		const heroSumPowerFinish = Object.values(heroGetAll).reduce((a, e) => a + e.power, 0);
		message += I18N('GOE_GOT_POWER', { gotPower: (heroSumPowerFinish - heroSumPowerStart).toLocaleString() });

		if (showProgress) {
			setProgress('', true);
		}

		if (!isAutoMode) {
			confShow(`${I18N('GOE_RESULT_OF_IMPROVEMENT', { counter: titanGiftUpgradeCounter })} ${message}`);
		}
	}

	// Get power (with target power amount)
	async function getPower(targetPower = null) {
		const [heroGetAll, inventory, user] = await new Caller(['heroGetAll', 'inventoryGet', 'userGetInfo']).execute();
		const heroes = Object.values(heroGetAll).sort((a, b) => a.titanGiftLevel - b.titanGiftLevel);
		const titanGiftLib = lib.getData('titanGift');
		const titanGift = inventory.consumable[CONSUMABLE_ID_TITAN_GIFT];
		const gold = user.gold;
		const isAutoMode = targetPower !== null;

		if (isAutoMode) {
			const result = findMaximumPossiblePower(heroes, titanGift, titanGiftLib);
			const notEnoughGold = result.needGoldToGetMaxPower > gold
				? I18N('GOE_NOT_ENOUGH_GOLD', {
					haveGold: gold.toLocaleString(),
					goldIsNeeded: result.needGoldToGetMaxPower.toLocaleString()
				})
				: '';

			if (targetPower === 0 || targetPower > result.maximumPowerWeCanGet) {
				return;
			}

			await upgradeTitanGifts({
				targetPower,
				isAutoMode: true,
				showProgress: false,
			});
		} else {
			const result = findMaximumPossiblePower(heroes, titanGift, titanGiftLib);
			const notEnoughGold = result.needGoldToGetMaxPower > gold
				? I18N('GOE_NOT_ENOUGH_GOLD', {
					haveGold: gold.toLocaleString(),
					goldIsNeeded: result.needGoldToGetMaxPower.toLocaleString()
				})
				: '';

			const needHeroPower = +(await popup.confirm(
				`${I18N('GOE_GET_POWER_MESSAGE', { maxHeroPawer: result.maximumPowerWeCanGet.toLocaleString() })} ${notEnoughGold}`,
				[
					{ result: 0, isClose: true },
					{ msg: `${I18N('GOE_GET_POWER')}`, isInput: true, default: result.maximumPowerWeCanGet, color: 'green' },
				]
			));

			if (needHeroPower === 0 || !needHeroPower || needHeroPower < 0 || needHeroPower > result.maximumPowerWeCanGet) {
				if (needHeroPower !== 0) {
					confShow(`${I18N('GOE_INCORRECT_VALUE')}`);
				}
				return;
			}

			await upgradeTitanGifts({
				targetPower: needHeroPower,
				isAutoMode: false,
				showProgress: true,
			});
		}
	}

	// Spend sparks of power
	async function spendSparksPower() {
		const [heroGetAll, inventory] = await new Caller(['heroGetAll', 'inventoryGet']).execute();
		const heroes = Object.values(heroGetAll).sort((a, b) => a.titanGiftLevel - b.titanGiftLevel);
		const titanGift = inventory.consumable[CONSUMABLE_ID_TITAN_GIFT];
		const titanGiftMax = titanGift;

		const titanGiftAmount = +(await popup.confirm(
			I18N('GOE_SPEND_SPARKS_OF_POWER_MESSAGE', { titanGift: titanGift.toLocaleString() }),
			[
				{ result: 0, isClose: true },
				{ msg: `${I18N('GOE_SPEND_SPARKS_OF_POWER')}`, isInput: true, default: titanGift.toString(), color: 'green' },
			]
		));

		if (titanGiftAmount === 0 || !titanGiftAmount || titanGiftAmount < 0 || titanGiftAmount > titanGiftMax) {
			if (titanGiftAmount !== 0) {
				confShow(`${I18N('GOE_INCORRECT_VALUE')}`);
			}
			return;
		}

		await upgradeTitanGifts({
			targetTitanGift: titanGiftAmount,
			isAutoMode: false,
			showProgress: true,
		});
	}

	// Reset titan gifts (level 1-29)
	async function resetTitanGifts() {
		const [heroGetAll, user] = await new Caller(['heroGetAll', 'userGetInfo']).execute();
		const heroes = Object.values(heroGetAll).sort((a, b) => a.titanGiftLevel - b.titanGiftLevel);
		const userLevel = user.level;
		let maxResetTitanGiftLevel = 0;

		for (const hero of heroes) {
			if (hero.titanGiftLevel > 0) {
				maxResetTitanGiftLevel = hero.titanGiftLevel;
				break;
			}
		}

		if (userLevel < MIN_USER_LEVEL || maxResetTitanGiftLevel === 0) {
			confShow(`${I18N('GOE_NOTHING_TO_RESET')}`);
			return;
		}

		if (maxResetTitanGiftLevel === MAX_TITAN_GIFT_LEVEL) {
			confShow(`${I18N('GOE_IMPOSSIBLE_TO_RESET')}`);
			return;
		}

		maxResetTitanGiftLevel = +(await popup.confirm(I18N('GOE_RESET_GIFTS_LIGHT_MESSAGE'), [
			{ result: 0, isClose: true },
			{ msg: I18N('GOE_RESET_GIFTS'), isInput: true, default: maxResetTitanGiftLevel.toString(), color: 'green' },
		]));

		if (maxResetTitanGiftLevel === 0 || !maxResetTitanGiftLevel || maxResetTitanGiftLevel < 0 || maxResetTitanGiftLevel > 29) {
			if (maxResetTitanGiftLevel !== 0) {
				confShow(`${I18N('GOE_INCORRECT_VALUE')}`);
			}
			return;
		}

		const calls = [];
		for (const hero of heroes) {
			if (hero.titanGiftLevel === 0) {
				continue;
			}
			if (hero.titanGiftLevel > maxResetTitanGiftLevel || hero.titanGiftLevel === MAX_TITAN_GIFT_LEVEL) {
				break;
			}
			calls.push({ name: 'heroTitanGiftDrop', args: { heroId: hero.id } });
		}

		if (calls.length === 0) {
			confShow(`${I18N('GOE_NOTHING_TO_RESET')}`);
			return;
		}

		await Caller.send(calls);
		confShow(`${I18N('GOE_RESULT_RESET_GIFTS', { counter: calls.length })}`);
	}

	// Reset titan gifts level 30
	async function resetTitanGifts30LVL() {
		const [heroGetAll, user] = await new Caller(['heroGetAll', 'userGetInfo']).execute();
		const heroes = Object.values(heroGetAll).sort((a, b) => a.titanGiftLevel - b.titanGiftLevel);
		const userLevel = user.level;
		const heroesLvl1_29 = Object.values(heroGetAll).filter((e) => e.titanGiftLevel > 0 && e.titanGiftLevel < MAX_TITAN_GIFT_LEVEL);
		const heroesLvl30 = Object.values(heroGetAll)
			.filter((e) => e.titanGiftLevel === MAX_TITAN_GIFT_LEVEL)
			.sort((a, b) => a.power - b.power);

		let maxResetTitanGiftLevel = 0;
		for (const hero of heroes) {
			if (hero.titanGiftLevel > 0) {
				maxResetTitanGiftLevel = hero.titanGiftLevel;
				break;
			}
		}

		if (userLevel < MIN_USER_LEVEL || maxResetTitanGiftLevel === 0) {
			confShow(`${I18N('GOE_NOTHING_TO_RESET')}`);
			return;
		}

		const numberHeroesWithLevel30 = heroesLvl30.length;
		let numberHeroesToReset = numberHeroesWithLevel30;

		if (numberHeroesWithLevel30 === 0) {
			const resultPopup = await popup.confirm(I18N('GOE_EXTREME_DO_NOT_HAVE_HERO_30LVL'), [
				{ msg: I18N('GOE_RESET_GIFTS'), result: true, color: 'green' },
				{ msg: I18N('BTN_CANCEL'), result: false, color: 'red' },
				{ isClose: true, result: false },
			]);
			if (!resultPopup) {
				return;
			}
		} else {
			numberHeroesToReset = +(await popup.confirm(I18N('GOE_RESET_GIFTS_EXTREME_MESSAGE', { level30: numberHeroesWithLevel30 }), [
				{ result: 0, isClose: true },
				{ msg: I18N('GOE_RESET_GIFTS'), isInput: true, default: numberHeroesToReset.toString(), color: 'green' },
			]));

			if (numberHeroesToReset === 0 || !numberHeroesToReset || numberHeroesToReset < 0 || numberHeroesToReset > numberHeroesWithLevel30) {
				if (numberHeroesToReset !== 0) {
					confShow(`${I18N('GOE_INCORRECT_VALUE')}`);
				}
				return;
			}
		}

		const calls = [];
		for (const hero of heroesLvl1_29) {
			calls.push({ name: 'heroTitanGiftDrop', args: { heroId: hero.id } });
		}
		for (let i = 0; i < numberHeroesToReset; i++) {
			calls.push({ name: 'heroTitanGiftDrop', args: { heroId: heroesLvl30[i].id } });
		}

		if (calls.length === 0) {
			confShow(`${I18N('GOE_NOTHING_TO_RESET')}`);
			return;
		}

		await Caller.send(calls);
		confShow(
			`${I18N('GOE_RESULT_RESET_GIFTS', { counter: calls.length })} ${I18N('GOE_EXTREME_RESULT_RESET_GIFTS', {
				counter30: numberHeroesToReset,
			})}`
		);
	}

	// Collect all quest rewards (only quests with ID > 1780000000)
	async function collectAllQuestRewards() {
		try {
			const farmQuestIds = new Set();
			let totalCollected = 0;
			let iteration = 0;

			// Collect only quests with ID > 1780000000
			while (iteration < QUEST_COLLECTION_MAX_ITERATIONS) {
				iteration++;
				console.log(`%c${GM_info.script.name}: Quest collection iteration ${iteration}`, 'color: blue');

				const questGetAll = await new Caller('questGetAll').execute();
				const allQuests = Array.isArray(questGetAll) ? questGetAll : Object.values(questGetAll || {});
				
				// Filter for completed quests (state === 2) with ID > 1780000000 only
				const questsToFarm = allQuests.filter(q => {
					if (!q || q.state !== 2) return false;
					const questId = +q.id;
					return questId && !isNaN(questId) && questId > QUEST_ID_FILTER_THRESHOLD;
				});

				if (questsToFarm.length === 0) {
					console.log(`%c${GM_info.script.name}: No more quests to collect (ID > ${QUEST_ID_FILTER_THRESHOLD})`, 'color: green');
					break;
				}

				const questIdsToFarm = [];
				for (const quest of questsToFarm) {
					const questId = +quest.id;
					if (questId && !isNaN(questId) && !farmQuestIds.has(questId)) {
						questIdsToFarm.push(questId);
						farmQuestIds.add(questId);
					}
				}

				if (questIdsToFarm.length === 0) {
					console.log(`%c${GM_info.script.name}: All available quests already collected`, 'color: green');
					break;
				}

				// Collect each quest individually (one by one)
				let successfulCount = 0;
				let failedQuestIds = [];
				const allSideResults = [];

				for (const questId of questIdsToFarm) {
					try {
						const farmCaller = new Caller();
						farmCaller.add({
							name: 'questFarm',
							args: { questId },
						});

						const farmResults = await farmCaller.send();
						const sideResults = farmResults.sideResult('questFarm', true) || [];
						const sideResult = sideResults[0];

						if (sideResult?.error) {
							const error = sideResult.error;
							const errorName = (typeof error === 'object' ? error.name : '') || '';
							const errorDesc = (typeof error === 'object' ? error.description : String(error)) || '';

							if (errorName === 'NotAvailable' ||
								errorDesc.includes('not pass farm requirements') ||
								errorDesc.includes('not available')) {
								failedQuestIds.push(questId);
								farmQuestIds.delete(questId);
								console.log(`%c${GM_info.script.name}: Skipping quest ${questId} - ${errorDesc || errorName}`, 'color: orange');
							} else {
								successfulCount++;
								allSideResults.push(sideResult);
							}
						} else {
							successfulCount++;
							if (sideResult) {
								allSideResults.push(sideResult);
							}
						}
					} catch (error) {
						console.error(`%c${GM_info.script.name}: Error farming quest ${questId}:`, 'color: red', error);
						
						const errorMessage = error.message || error.toString() || '';
						const isNotAvailableError = errorMessage.includes('NotAvailable') ||
							errorMessage.includes('not pass farm requirements') ||
							errorMessage.includes('not available');

						if (isNotAvailableError) {
							failedQuestIds.push(questId);
							farmQuestIds.delete(questId);
							console.log(`%c${GM_info.script.name}: Skipping quest ${questId} - ${errorMessage}`, 'color: orange');
						}
					}

					// Small delay between individual quest calls
					await new Promise(resolve => setTimeout(resolve, QUEST_COLLECTION_DELAY));
				}

				totalCollected += successfulCount;
				if (successfulCount > 0) {
					console.log(`%c${GM_info.script.name}: Collected ${successfulCount} quest reward(s)`, 'color: green');
				}
				if (failedQuestIds.length > 0) {
					console.log(`%c${GM_info.script.name}: Skipped ${failedQuestIds.length} quest(s) that don't meet farm requirements`, 'color: orange');
				}

				// Check for newly unlocked quests (only high-ID quests)
				let hasNewQuests = false;
				for (const sideResult of allSideResults) {
					if (!sideResult) continue;

					const quests = [...(sideResult.newQuests ?? []), ...(sideResult.quests ?? [])];
					for (const quest of quests) {
						if (quest?.state === 2) {
							const newQuestId = +quest.id;
							if (newQuestId && newQuestId > QUEST_ID_FILTER_THRESHOLD && !farmQuestIds.has(newQuestId)) {
								hasNewQuests = true;
								break;
							}
						}
					}
					if (hasNewQuests) break;
				}

				await new Promise(resolve => setTimeout(resolve, QUEST_COLLECTION_DELAY * 2));

				if (!hasNewQuests && successfulCount === 0) {
					break;
				}
			}

			if (iteration >= QUEST_COLLECTION_MAX_ITERATIONS) {
				console.warn(`%c${GM_info.script.name}: Quest collection reached max iterations (${QUEST_COLLECTION_MAX_ITERATIONS})`, 'color: orange');
			}

			if (totalCollected > 0) {
				console.log(`%c${GM_info.script.name}: Quest collection completed. Total collected: ${totalCollected}`, 'color: green');
			} else {
				console.log(`%c${GM_info.script.name}: No quest rewards to collect`, 'color: gray');
			}

			return totalCollected;
		} catch (error) {
			console.error(`%c${GM_info.script.name}: Error collecting quest rewards:`, 'color: red', error);
			return 0;
		}
	}

	// Auto-execution on script load
	let checkCount = 0;
	const waitForHWHReady = setInterval(() => {
		checkCount++;
		if (checkCount > AUTO_EXECUTION_TIMEOUT) {
			clearInterval(waitForHWHReady);
			console.log(`%c${GM_info.script.name}: Auto-execution timeout - HWH not ready after ${AUTO_EXECUTION_TIMEOUT * 0.2}s`, 'color: red');
			return;
		}

		if (this.HWHClasses?.ScriptMenu && HWHFuncs && lib && cheats) {
			const scriptMenu = this.HWHClasses.ScriptMenu.getInst();
			if (scriptMenu?.mainMenu) {
				clearInterval(waitForHWHReady);
				console.log(`%c${GM_info.script.name}: HWH UI is ready, checking auto-execution settings...`, 'color: blue');

				setTimeout(async () => {
					try {
						const { getSaveVal } = HWHFuncs;
						let autoGetPower = getSaveVal('autoGetPower', false);
						let autoGetPowerAmount = getSaveVal('autoGetPowerAmount', 0);

						console.log(`%c${GM_info.script.name}: Auto-execution check - enabled: ${autoGetPower}, amount: ${autoGetPowerAmount}`, 'color: blue');

						if (autoGetPower) {
							if (autoGetPowerAmount > 0) {
								console.log(`%c${GM_info.script.name}: Auto-executing getPower with target: ${autoGetPowerAmount}`, 'color: green');
								await getPower(autoGetPowerAmount);
							}
							console.log(`%c${GM_info.script.name}: Auto-executing quest reward collection...`, 'color: green');
							await collectAllQuestRewards();
							console.log(`%c${GM_info.script.name}: Auto-execution completed`, 'color: green');
						} else {
							console.log(`%c${GM_info.script.name}: Auto-execution skipped - enabled: ${autoGetPower}, amount: ${autoGetPowerAmount}`, 'color: orange');
						}
					} catch (error) {
						console.error(`%c${GM_info.script.name}: Auto-execution error:`, 'color: red', error);
					}
				}, AUTO_EXECUTION_DELAY);
			} else if (checkCount % 10 === 0) {
				console.log(`%c${GM_info.script.name}: Waiting for HWH mainMenu... (check ${checkCount})`, 'color: gray');
			}
		} else if (checkCount % 10 === 0) {
			console.log(`%c${GM_info.script.name}: Waiting for HWH components... (check ${checkCount})`, 'color: gray');
		}
	}, 200);
})();
