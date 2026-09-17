// ==UserScript==
// @name			HWHhuntFragmentExt
// @name:en			HWHhuntFragmentExt
// @name:ru			HWHhuntFragmentExt
// @namespace		HWHhuntFragmentExt
// @version			0.0.49
// @description		Extension for HeroWarsHelper script
// @description:en	Extension for HeroWarsHelper script
// @description:ru	Расширение для скрипта HeroWarsHelper
// @author			dimaka1256
// @license 		Copyright dimaka1256
// @homepage		none
// @icon			https://zingery.ru/scripts/VaultBoyIco16.ico
// @icon64			https://zingery.ru/scripts/VaultBoyIco64.png
// @match			https://www.hero-wars.com/*
// @match			https://apps-1701433570146040.apps.fbsbx.com/*
// @run-at			document-start
// @downloadURL https://update.greasyfork.org/scripts/537105/HWHhuntFragmentExt.user.js
// @updateURL https://update.greasyfork.org/scripts/537105/HWHhuntFragmentExt.meta.js
// ==/UserScript==

(function () {

    if (!this.HWHClasses) {
		console.log('%cObject for extension not found', 'color: red');
		return;
	}

	console.log('%cStart Extension ' + GM_info.script.name + ', v' + GM_info.script.version + ' by ' + GM_info.script.author, 'color: red');
	const { addExtentionName } = HWHFuncs;
	addExtentionName(GM_info.script.name, GM_info.script.version, GM_info.script.author);

	const {
		setProgress,
		getSaveVal,
		setSaveVal,
		popup,
        I18N,
		getUserInfo,
	} = HWHFuncs;

let {buttons,i18nLangData} = HWHData;

let ruLang ={
    FRAGMENT_HUNT: 'Слить энку',
    FRAGMENT_HUNT_TITLE: 'Добывать фрагменты шмоток/рецептов',
	FRAGMENT_HUNT_SETUP: '⚙️',
    FRAGMENT_HUNT_SETUP_TITLE: 'Выбор фрагмента/миссии',
	FRAGMENT_HUNT_ENERGY: '⚡️',
    FRAGMENT_HUNT_FR: '🧩',
    FRAGMENT_HUNT_MISSION: 'миссия',
	FRAGMENT_HUNT_WORLD: 'Глава',
	FRAGMENT_HUNT_SPENT: 'Потратили ',
    FRAGMENT_HUNT_GOTFRAGMENTS: ', получили такой лут:',
    FRAGMENT_HUNT_PCS: 'шт',
    FRAGMENT_HUNT_WEHUNT: 'Добываем предметы',
    FRAGMENT_HUNT_ENOUGH1: ', хватит на ',
    FRAGMENT_HUNT_ENOUGH2: ' рейдов x10',
    FRAGMENT_HUNT_CHANGE: 'Выбрать',
    FRAGMENT_HUNT_PARTS1: 'Фиол шмот',
    FRAGMENT_HUNT_PARTS2: 'Фиол свитки А-О',
    FRAGMENT_HUNT_PARTS3: 'Фиол свитки П-Я',
    FRAGMENT_HUNT_PARTS4: 'Жёлтый шмот',
    FRAGMENT_HUNT_PARTS5: 'Жёлтые свитки А-К',
    FRAGMENT_HUNT_PARTS6: 'Жёлтые свитки Л-Я',
    FRAGMENT_HUNT_PARTS7: 'Красный шмот',
    FRAGMENT_HUNT_PARTS8: 'Красные свитки',
    FRAGMENT_HUNT_CHOOSEPART: 'Какую категорию шмотки ищём?',
    FRAGMENT_HUNT_CHOOSEITEM: 'Какую шмотку ищём?',
    FRAGMENT_HUNT_CHOOSEMISSION: 'В какой миссии? (см. ещё дроп)',
	FRAGMENT_HUNT_NOTENOUGH: 'Недостаточно энергии',
	FRAGMENT_HUNT_NOMISSION: 'Не выбрана миссия, нечего добывать',
	FRAGMENT_HUNT_DOALL: 'Слить энку на миссию',
	FRAGMENT_HUNT_NOVIP: 'Сорри, без VIP1 не работает',
	FRAGMENT_HUNT_SMALLVIP: 'Без VIP5 бьёт одиночными рейдами',
}
let enLang ={
    FRAGMENT_HUNT: 'Spend Stamina',
    FRAGMENT_HUNT_TITLE: 'Hunt for Item/Scroll fragment',
	FRAGMENT_HUNT_SETUP: '⚙️',
    FRAGMENT_HUNT_SETUP_TITLE: 'Choose fragment/mission',
	FRAGMENT_HUNT_ENERGY: '⚡️',
	FRAGMENT_HUNT_SPENT: 'Spent ',
    FRAGMENT_HUNT_FR: '🧩',
    FRAGMENT_HUNT_MISSION: 'mission',
	FRAGMENT_HUNT_WORLD: 'World',
    FRAGMENT_HUNT_GOTFRAGMENTS: ',g ot this loot:',
    FRAGMENT_HUNT_PCS: 'pcs',
    FRAGMENT_HUNT_WEHUNT: 'We hunt for items',
    FRAGMENT_HUNT_ENOUGH1: ', enough for ',
    FRAGMENT_HUNT_ENOUGH2: ' raids x10',
    FRAGMENT_HUNT_CHANGE: 'Choose',
    FRAGMENT_HUNT_PARTS1: 'Purple gear',
    FRAGMENT_HUNT_PARTS2: 'Purple scrolls 1',
    FRAGMENT_HUNT_PARTS3: 'Purple scrolls 2',
    FRAGMENT_HUNT_PARTS4: 'Yellow gear',
    FRAGMENT_HUNT_PARTS5: 'Yellow scrolls 1',
    FRAGMENT_HUNT_PARTS6: 'Yellow scrolls 2',
    FRAGMENT_HUNT_PARTS7: 'Red gear',
    FRAGMENT_HUNT_PARTS8: 'Red scrolls',
    FRAGMENT_HUNT_CHOOSEPART: 'Choose fragment category:',
    FRAGMENT_HUNT_CHOOSEITEM: 'Choose fragment:',
    FRAGMENT_HUNT_CHOOSEMISSION: 'Choose mission(look at other drop)',
	FRAGMENT_HUNT_NOTENOUGH: 'Not enough stamina',
	FRAGMENT_HUNT_NOMISSION: 'Mission not chosen',
	FRAGMENT_HUNT_DOALL: 'Consume stamina to a mission',
	FRAGMENT_HUNT_NOVIP: 'This requires at least VIP1 to run',
	FRAGMENT_HUNT_SMALLVIP: 'Only single raids without VIP5',
}
Object.assign(i18nLangData.ru, ruLang)
Object.assign(i18nLangData.en, enLang)
this.HWHData.i18nLangData = i18nLangData;

const fragmentHuntButton = {
    fragmentHuntButton: {
		isCombine: true,
		combineList: [
			{
				get name() { return I18N('FRAGMENT_HUNT'); }, 
				get title() { return I18N('FRAGMENT_HUNT_TITLE'); },
        		onClick: gohuntFragment,
				hide: false,
				color: 'red'
			},
			{
        		get name() { return I18N('FRAGMENT_HUNT_SETUP'); }, 
				get title() { return I18N('FRAGMENT_HUNT_SETUP_TITLE'); },
        		onClick: setuphuntFragment,
				hide: false,
				color: 'red'
			},
		]
}}

Object.assign(buttons,fragmentHuntButton)
this.HWHData.buttons = buttons;


function setuphuntFragment() {
		let fragment= new huntFragment();
		fragment.setup();
}

function gohuntFragment() {
		let fragment= new huntFragment();
		fragment.start();
}

//добавить галочку в "сделать всё"
//я буду гореть за это в аду
const task = {
			name: 'gohuntFragment',
			label: I18N('FRAGMENT_HUNT_DOALL'),
			checked: false
		}
const functions2 = {
		gohuntFragment
}

const {doYourBest} = HWHClasses;
const doIt = new doYourBest();
	let myfuncList=doIt.funcList
	myfuncList.splice (-3,0,task);
	let myfunctions = doIt.functions
	Object.assign(myfunctions, functions2)

	class extdoYourBest extends doYourBest {
		funcList = myfuncList
		functions = myfunctions
	}
this.HWHClasses.doYourBest = extdoYourBest;


class huntFragment {

	inventoryGet = []
	droptable = []
	stamina = 0
    raids = 0
    missionID = 0
    energyNeeded = 0

missionEnergy (id) {
		if (id == 0) {return 999999};
        if (id > 145) {return 10};
	    if (id  < 86) {return 6};
		return 8
}

checkvip() {
	let currentVipPoints = (getUserInfo()).vipPoints;
	if (currentVipPoints >999) {return 5}
	if (currentVipPoints >9) {return 1}
	return 0
}

isWithinRange(value, min, max) {
  return value >= min && value <= max;
}

generateArray(start, size) {
  return Array.from({length: size}, (_, index) => index + start);
}

getType(id){
	let type = "oops"
	if (this.isWithinRange (id, 21, 55) || this.isWithinRange (id, 56, 99) || this.isWithinRange (id, 167, 178) || this.isWithinRange (id, 221, 232)) {type="Gear"}
	if (this.isWithinRange (id, 141, 166) || this.isWithinRange (id, 190, 220) || this.isWithinRange (id, 244, 254)) {type="Scroll"}
	return type
}

getColor(id){
    if (this.isWithinRange (id, 21, 55)) {return "green"}
    if (this.isWithinRange (id, 141, 145)) {return "green"}
    if (this.isWithinRange (id, 56, 90)) {return "blue"}
	if (this.isWithinRange (id, 91, 166)) {return "purple"}
	if (this.isWithinRange (id, 167, 220)) {return "orange"}
	if (this.isWithinRange (id, 221, 254)) {return "red"}
	console.log ("getColor oops", id); return "white"
}

getName(id){
	this.updatemyData()
	let itemAvailable = 0
	let fullitemAvailable = 0;
	switch (this.getType(id)) {
	 case "Gear": {
		itemAvailable = this.inventoryGet.fragmentGear[id] ?? 0;
		fullitemAvailable = this.inventoryGet.gear[id] ?? 0; break;
	}
	 case "Scroll": {
		itemAvailable = this.inventoryGet.fragmentScroll[id] ?? 0;
		fullitemAvailable = this.inventoryGet.scroll[id] ?? 0; break;
	}
	}

	let color = this.getColor(id)
	let name = cheats.translate(`LIB_${(this.getType(id)).toUpperCase()}_NAME_${id}`);
	let words = name.split(" ")
	for (let i in words) {if (words[i].length > 8){name=name.replace(words[i],(words[i]).substring(0,5)+".")}}
	name = name.replace(" - Рецепт","-р"); 
	name = name.replace(", уровень ","-"); 
	name = name.replace(" уровень ","-");//эти сокращения локалить впадлу, совсем
	let out =""
    //out+=id //если нужен ид шмотки
	out+=' <span style="color:'+color+';">'+name+'</span> ('+fullitemAvailable+'+'+itemAvailable+I18N('FRAGMENT_HUNT_FR')+')';
	return out
}

generateitembuttons(itemids) {
	const buttons = [];
	for (let itemid in itemids) {
		let gearID = itemids[itemid]
		let name = this.getName(gearID);
		buttons.push({
					msg:  name,
					result: itemids[itemid],
					get title() { return name },
				});
	}
	buttons.push({msg: I18N('BTN_CANCEL'), result: false, isCancel: true})
	return buttons
}

generatemissionbuttons(missions, itemid) {
	const buttons = [];
	for (let mission in missions) {
		let missionID = missions[mission]
		let thismission = this.droptable.filter(m=>m.id===missionID)[0]
		let otheritems = thismission.drop.filter(d=>d != itemid) 
		let name = I18N('FRAGMENT_HUNT_WORLD')+" "+thismission.world+" "+I18N('FRAGMENT_HUNT_MISSION')+" "+thismission.index+"   "+this.missionEnergy(thismission.id)+I18N('FRAGMENT_HUNT_ENERGY')+"<br>"
		// I18N('FRAGMENT_HUNT_MISSION')+" "+ thismission.id
		for(let i in otheritems) {if (this.getType(otheritems[i]) === "oops"){continue;};name+=this.getName(otheritems[i])+"<br>";} 
		buttons.push({
					msg:  name,
					result: missionID,
					get title() { return name },
				});
	}
	buttons.push({msg: I18N('BTN_CANCEL'), result: false, isCancel: true})
	return buttons
}

async updatemyData(){
		let calls = [{
			name: "userGetInfo",
			args: {},
			ident: "userGetInfo"
		},{
			name: "inventoryGet",
			args: {},
			ident: "inventoryGet"
		}];
		let result = await Send(JSON.stringify({ calls }));
		let infos = result.results;
		this.stamina = (infos[0].result.response.refillable.find(n => n.id == 1)).amount;
		this.inventoryGet = infos[1].result.response;

	    this.energyNeeded = this.missionEnergy(this.missionID)
        //if (this.missionID > 145) {this.energyNeeded = 10};
	    //if (this.missionID  < 86) {this.energyNeeded = 6};
		//console.log ("vip",this.checkvip())
        switch (this.checkvip()){
			case 5: {this.raids = Math.floor(this.stamina/(this.energyNeeded*10)); break;}
			case 1: {this.raids = Math.floor(this.stamina/(this.energyNeeded)); break}
			case 0: {this.raids = 0; setProgress(I18N('FRAGMENT_HUNT_NOVIP'))}
		}
		return "ok"
}

async makeMission(mission,count){
	let nrg = this.energyNeeded*count;
	let calls = []

			switch (this.checkvip()){
			case 5: {calls.push({name: "missionRaid",args: {id: mission.id,times: (count)},ident: "body"}); break;}
			case 1: {
					for (let i = 0; i < count; i++)
					{
						calls.push({name: "missionRaid",args: {id: mission.id,times: 1},ident: "body"+"i"})
					}
					
				}
			}
			let result = await Send({ calls })
            console.log(result)
			let loot2 = []
			for (let j in result.results)
			{
				let loot = result.results[j].result.response
				for (let i in loot){
					if (!!loot[i].fragmentScroll) {loot2.push(loot[i].fragmentScroll)}
					if (!!loot[i].fragmentGear) {loot2.push(loot[i].fragmentGear)}
				}
			}
				let loot3=[]
                //console.log("loot2",loot2)
				for (let i in loot2) {
                    for (let j in Object.keys(loot2[i])) {loot3.push(Object.keys(loot2[i])[j])}                    
			}
			await this.updatemyData()
            //console.log("loot3",loot3)
			let str = I18N('FRAGMENT_HUNT_SPENT')+nrg+I18N('FRAGMENT_HUNT_ENERGY')+ I18N('FRAGMENT_HUNT_GOTFRAGMENTS')+"<br>"
			let usedids = []
			let loot4=[]
			for (let i in loot3) {
				if (!usedids.includes(loot3[i])){loot4.push({id:loot3[i],qty:1}); usedids.push(loot3[i])}
				else {(loot4.find(e => e.id== loot3[i])).qty++}
			}
			for (let i in loot4){
				str+=this.getName(loot4[i].id)+": "+loot4[i].qty+ I18N('FRAGMENT_HUNT_PCS')+"<br>"
			}
			setProgress(str)
            //if (this.raids >0) {this.start(false)}
}

updateDroptable(){
  const dropTable2 = ((types = ['gear', 'fragmentGear', 'scroll', 'fragmentScroll']) => {
  return Object.values(lib.data.mission).map(e => {
  const lastWave = e.normalMode?.waves?.at(-1);
  const lastEnemy = lastWave?.enemies?.at(-1);
  let dropList = lastEnemy?.drop ?? [];
  let heromissions = []
  for(const i of dropList) {
	const type = Object.keys(i.reward)[0]
	if (type == 'fragmentHero') {
		//console.log('heromission',e.id); 
		heromissions.push(e.id)
	}
  }
  const drop = [];
  for(const d of dropList) {
    const type = Object.keys(d.reward).pop()
    if (d.chance && types.includes(type) && !(heromissions.includes(e.id))) {
      const id = Object.keys(d.reward[type]).pop()
      if (id>90) {drop.push(+id)}
    }
  }
  return {id: e.id, world: e.world, index: e.index, drop}
}).filter(n => n.drop.length)
})()
//console.log("dropTable2",dropTable2)
this.droptable = dropTable2
}

async start() {
	this.updateDroptable()
	this.missionID = getSaveVal('huntFragmentMission', 999)
	let mission = this.droptable.filter(m=>m.id===this.missionID)[0]
	//console.log ("start missionID",this.missionID,mission)
    if (!mission) {console.log("nomission"); this.setup();} //если в конфиге кака сначала настройка
	await this.updatemyData()
		console.log("Энки у нас",this.stamina," рейдов доступно",this.raids)

		if (this.raids >0) {
			 if (this.checkvip() == 5){this.makeMission(mission,this.raids*10); }
			 else {this.makeMission(mission,this.raids); }
		} 
		else {setProgress(I18N('FRAGMENT_HUNT_NOTENOUGH'))}
	}

async setup() {
	this.updateDroptable()
	//console.log("droptable2 updated",this.droptable)
	this.missionID = getSaveVal('huntFragmentMission', 999)
	let mission = this.droptable.filter(m=>m.id===this.missionID)[0]
	//console.log ("setup missionID",this.missionID)
	let message = ""; let maxraid =""; let target="";
	if (this.checkvip() != 5) {message+=I18N('FRAGMENT_HUNT_SMALLVIP')}

	if (!mission) {
		this.raids = 0; 
		message = I18N('FRAGMENT_HUNT_NOMISSION')} //костыль чтоб точно выбрали миссию
	else {
		await this.updatemyData()
		for (let i in mission.drop){let id=mission.drop[i]; target+=this.getName(id)+"<br>";}
		maxraid = I18N('RAID')+" х"
		if (this.checkvip()==5) {maxraid+=this.raids*10} else {maxraid+=this.raids}
		message = I18N('FRAGMENT_HUNT_WEHUNT')+":<br> "+target+" <br>"+I18N('FRAGMENT_HUNT_WORLD')+" "+mission.world+" "+I18N('FRAGMENT_HUNT_MISSION')+" "+mission.index+"    "+this.energyNeeded+" "+I18N('FRAGMENT_HUNT_ENERGY')+"<br>"+I18N('FRAGMENT_HUNT_ENERGY')+" "+this.stamina+I18N('FRAGMENT_HUNT_ENOUGH1')+this.raids+I18N('FRAGMENT_HUNT_ENOUGH2')
	}
	
	let buttons0 = []
	if (this.raids > 0 && this.checkvip()==5) {buttons0.push({msg: I18N('RAID')+" х10", result: "1"})}
	if (this.raids > 1) {buttons0.push({msg: maxraid, result: "2"})}
	buttons0.push({msg: I18N('FRAGMENT_HUNT_CHANGE'), result: "3"})
	buttons0.push({msg: I18N('BTN_CANCEL'), result: false})

	this.answerr = await popup.confirm(message, buttons0);
	
	const parts = [I18N('FRAGMENT_HUNT_PARTS1'),I18N('FRAGMENT_HUNT_PARTS2'),I18N('FRAGMENT_HUNT_PARTS3'),I18N('FRAGMENT_HUNT_PARTS4'),I18N('FRAGMENT_HUNT_PARTS5'),I18N('FRAGMENT_HUNT_PARTS6'),I18N('FRAGMENT_HUNT_PARTS7'),I18N('FRAGMENT_HUNT_PARTS8')]
	const buttons = [];
	for (let i in parts ) {
		buttons.push({
					msg: parts[i],
					result: i,
					get title() { return "test" },
				});
	}
	buttons.push({msg: I18N('BTN_CANCEL'), result: false, isCancel: true})
	let answer=0;
	switch (this.answerr) { 
		case "1": {
			//console.log("тут будет рейд х10",mission.id);
			this.makeMission(mission,10)
			break;
			}
		case "2": {
			//console.log("тут будет макс рейд",mission.id); 
			this.makeMission(mission,this.raids*10)
			break;}
		case "3": {answer = await popup.confirm(I18N('FRAGMENT_HUNT_CHOOSEPART'), buttons); break;}
		default: {return;}
	}
	if (!answer) {return}

	let array=[]
	switch (answer) { 
		case "0": { array=this.generateArray(91,8);break;}
		case "1": { array=[158,153,162,164,165,157,152,166]; break;} //(152,15)
		case "2": { array=[163,159,154,161,156,160,155]; break;}
		case "3": { array=this.generateArray(167,12);break;}
		case "4": { array=[190,194,197,205,204,215,214,196,218,193,219,217,206]; break;}
		case "5": { array=[198,220,195,192,216,191,199,200]; break;}
		case "6": { array=this.generateArray(221,12); break;}
		case "7": { array=this.generateArray(244,11); break;}
		default: {console.log("oops"); break;}
	}
	let answer2 = await popup.confirm(I18N('FRAGMENT_HUNT_CHOOSEITEM'), this.generateitembuttons(array));
	if (!answer2) {return}

	let missions = this.droptable.filter(m=>m.drop.includes(answer2))
	let missarray = []
	for (let i in missions) {missarray.push(missions[i].id)}
	let answer3 = await popup.confirm(I18N('FRAGMENT_HUNT_CHOOSEMISSION')+"<br>"+this.getName(answer2), this.generatemissionbuttons(missarray,answer2));
	if (!answer3) {return}

	setSaveVal('huntFragmentMission', answer3)
	this.setup()
}
}
this.HWHClasses.huntFragment = huntFragment;
})();

//TODO:
// формат "одной кнопки" для "сделать всё"
