/*!
 * @license
 *
 * pzpr.js vc3701af6
 *  https://github.com/sabo2/pzprv3
 *
 * This script includes candle.js, see below
 *  https://github.com/sabo2/candle
 *
 * Copyright 2009-2020 sabo2
 *
 * This script is released under the MIT license. Please see below.
 *  http://www.opensource.org/licenses/mit-license.php
 *
 * Date: 2020-10-27
 */
// intro.js

(function(){

// Boot.js v3.4.0

(function() {
	/********************************/
	/* 初期化時のみ使用するルーチン */
	/********************************/

	var onload_pzl = null;
	var onload_option = {};

	//---------------------------------------------------------------------------
	// ★boot() window.onload直後の処理
	//---------------------------------------------------------------------------
	pzpr.on("load", function boot() {
		if (importData()) {
			startPuzzle();
		} else {
			setTimeout(boot, 0);
		}
	});

	function importData() {
		if (!onload_pzl) {
			/* 1) 盤面複製・index.htmlからのファイル入力/Database入力か */
			/* 2) URL(?以降)をチェック */
			onload_pzl = importFileData() || importURL();

			/* 指定されたパズルがない場合はさようなら～ */
			if (!onload_pzl || !onload_pzl.pid) {
				failOpen();
			}
		}

		return true;
	}

	function failOpen() {
		if (!!ui.puzzle && !!ui.puzzle.pid) {
			return;
		}
		var title2 = document.getElementById("title2");
		if (!!title2) {
			title2.innerHTML = "Fail to import puzzle data or URL.";
		}
		document.getElementById("menupanel").innerHTML = "";
		//throw new Error("No Include Puzzle Data Exception");
	}

	function startPuzzle() {
		var pzl = onload_pzl;

		/* IE SVGのtextLengthがうまく指定できていないので回避策を追加 */
		if (
			(function(ua) {
				return (
					ua.match(/MSIE/) || (ua.match(/AppleWebKit/) && ua.match(/Edge/))
				);
			})(navigator.userAgent)
		) {
			onload_option.graphic = "canvas";
		}

		/* パズルオブジェクトの作成 */
		var element = document.getElementById("divques");
		var puzzle = (ui.puzzle = new pzpr.Puzzle(element, onload_option));
		pzpr.connectKeyEvents(puzzle);

		/* パズルオブジェクト作成〜open()間に呼ぶ */
		ui.event.onload_func(onload_option);

		// 単体初期化処理のルーチンへ
		puzzle.once("fail-open", failOpen);
		puzzle.open(pzl);
		if (onload_option.variant !== void 0) {
			puzzle.config.set("variant", true);
		}

		puzzle.on("request-aux-editor", ui.auxeditor.open);

		if (!!onload_option.net) {
			ui.network.configure(onload_option.net, onload_option.key);
		}

		return true;
	}

	//---------------------------------------------------------------------------
	// ★importURL() 初期化時にURLを解析し、パズルの種類・エディタ/player判定を行う
	//---------------------------------------------------------------------------
	function importURL() {
		/* index.htmlからURLが入力されたかチェック */
		var search = getStorageData("pzprv3_urldata", "urldata");

		/* index.htmlからURLが入力されていない場合は現在のURLの?以降をとってくる */
		search = search || location.search;
		if (!search) {
			return null;
		}

		/* 一旦先頭の?記号を取り除く */
		if (search.charAt(0) === "?") {
			search = search.substr(1);
		}

		while (search.match(/^(\w+)\=(\w+)\&(.*)/)) {
			onload_option[RegExp.$1] = RegExp.$2;
			search = RegExp.$3;
		}

		var pzl = pzpr.parser.parseURL(search);
		var startmode = pzl.mode || (!pzl.body ? "editor" : "player");
		onload_option.type = onload_option.type || startmode;

		return pzl;
	}

	//---------------------------------------------------------------------------
	// ★importFileData() 初期化時にファイルデータの読み込みを行う
	//---------------------------------------------------------------------------
	function importFileData() {
		/* index.htmlや盤面の複製等でファイルorブラウザ保存データが入力されたかチェック */
		var fstr = getStorageData("pzprv3_filedata", "filedata");
		if (!fstr) {
			return null;
		}

		var pzl = pzpr.parser.parseFile(fstr, "");
		if (!pzl) {
			return null;
		}

		return pzl;
	}

	//---------------------------------------------------------------------------
	// ★getStorageData() localStorageやsesseionStorageのデータを読み込む
	//---------------------------------------------------------------------------
	function getStorageData(key, key2) {
		// 移し変える処理
		var str = localStorage[key];
		if (typeof str === "string") {
			delete localStorage[key];
			sessionStorage[key2] = str;
		}

		str = sessionStorage[key2];
		return typeof str === "string" ? str : null;
	}
})();

// UI.js v3.4.0
/* eslint-env browser */
/* exported ui, _doc, getEL, createEL */

/* ui.js Locals */
var _doc = document;
function getEL(id) {
	return _doc.getElementById(id);
}
function createEL(tagName) {
	return _doc.createElement(tagName);
}

//---------------------------------------------------------------------------
// ★uiオブジェクト UserInterface側のオブジェクト
//---------------------------------------------------------------------------
/* extern */
window.ui = {
	version: "c3701af6",

	/* このサイトで使用するパズルのオブジェクト */
	puzzle: null,

	/* どの種類のパズルのメニューを表示しているか */
	currentpid: "",

	/* メンバオブジェクト */
	event: null,
	menuconfig: null,
	urlconfig: null,
	menuarea: null,
	toolarea: null,
	popupmgr: null,
	keypopup: null,
	timer: null,
	network: null,

	enableGetText: false, // FileReader APIの旧仕様でファイルが読めるか
	enableReadText: false, // HTML5 FileReader APIでファイルが読めるか
	reader: null, // FileReaderオブジェクト

	enableSaveImage: false, // 画像保存が可能か
	enableImageType: {}, // 保存可能な画像形式

	enableSaveBlob: false, // saveBlobが使用できるか

	callbackComplete: null,

	//---------------------------------------------------------------------------
	// ui.displayAll()     全てのメニュー、ボタン、ラベルに対して文字列を設定する
	// ui.setdisplay()     個別のメニュー、ボタン、ラベルに対して文字列を設定する
	//---------------------------------------------------------------------------
	displayAll: function() {
		ui.menuarea.display();
		ui.toolarea.display();
		ui.popupmgr.translate();
		ui.misc.displayDesign();
	},
	setdisplay: function(idname) {
		ui.menuarea.setdisplay(idname);
		ui.toolarea.setdisplay(idname);
	},

	//---------------------------------------------------------------------------
	// ui.customAttr()   エレメントのカスタムattributeの値を返す
	//---------------------------------------------------------------------------
	customAttr: function(el, name) {
		var value = "";
		if (el.dataset !== void 0) {
			value = el.dataset[name];
		} else {
			/* IE10, Firefox5, Chrome7, Safari5.1以下のフォールバック */
			var lowername = "data-";
			for (var i = 0; i < name.length; i++) {
				var ch = name[i] || name.charAt(i);
				lowername += ch >= "A" && ch <= "Z" ? "-" + ch.toLowerCase() : ch;
			}
			value = el[lowername] || el.getAttribute(lowername) || "";
		}
		return value;
	},

	//----------------------------------------------------------------------
	// ui.windowWidth()   ウィンドウの幅を返す
	//----------------------------------------------------------------------
	windowWidth: function() {
		return window.innerHeight !== void 0
			? window.innerWidth
			: _doc.body.clientWidth;
	},

	//---------------------------------------------------------------------------
	// ui.adjustcellsize()  resizeイベント時に、pc.cw, pc.chのサイズを(自動)調節する
	// ui.getBoardPadding() Canvasと境界線の周りの間にあるpaddingのサイズを求めます
	//---------------------------------------------------------------------------
	adjustcellsize: function() {
		var puzzle = ui.puzzle,
			pc = puzzle.painter;
		var cols = pc.getCanvasCols() + ui.getBoardPadding() * 2;
		var wwidth = ui.windowWidth() - (ui.urlconfig.embed ? 0 : 6);
		var mwidth; //  margin/borderがあるので、適当に引いておく
		var uiconf = ui.menuconfig;

		var cellsize,
			cellsizeval = uiconf.get("cellsizeval");
		var cr = { base: 1.0, limit: 0.4 },
			ws = { base: 0.8, limit: 0.96 },
			ci = [];
		ci[0] = (wwidth * ws.base) / (cellsizeval * cr.base);
		ci[1] = (wwidth * ws.limit) / (cellsizeval * cr.base);
		ci[2] = (wwidth * ws.limit) / (cellsizeval * cr.limit);

		// 横幅いっぱいに広げたい場合
		if (uiconf.get("fullwidth")) {
			mwidth = wwidth * 0.98;
			cellsize = (mwidth * 0.92) / cols;
		}
		// 縮小が必要ない場合
		else if (!uiconf.get("adjsize") || cols < ci[0]) {
			mwidth = wwidth * ws.base - 4;
			cellsize = cellsizeval * cr.base;
		}
		// ひとまずセルのサイズを変えずにmainの幅を調節する場合
		else if (cols < ci[1]) {
			cellsize = cellsizeval * cr.base;
			mwidth = cellsize * cols;
		}
		// base～limit間でサイズを自動調節する場合
		else if (cols < ci[2]) {
			mwidth = wwidth * ws.limit - 4;
			cellsize = mwidth / cols; // 外枠ぎりぎりにする
		}
		// 自動調整の下限値を超える場合
		else {
			cellsize = cellsizeval * cr.limit;
			mwidth = cellsize * cols;
		}

		// mainのサイズ変更
		if (!pc.outputImage) {
			getEL("main").style.width = "" + (mwidth | 0) + "px";
			if (ui.urlconfig.embed) {
				getEL("main").style.border = "none";
			}
		}

		puzzle.setCanvasSizeByCellSize(cellsize);
	},
	getBoardPadding: function() {
		var puzzle = ui.puzzle,
			padding = 0;
		switch (puzzle.pid) {
			case "firefly":
			case "hashikake":
			case "wblink":
			case "ichimaga":
			case "ichimagam":
			case "ichimagax":
				padding = 0.3;
				break;

			case "kouchoku":
			case "gokigen":
			case "wagiri":
			case "creek":
				padding = 0.2;
				break;

			case "slither":
			case "cave":
			case "mejilink":
				padding = 0.15;
				break;

			case "kinkonkan":
			case "skyscrapers":
			case "easyasabc":
			case "box":
				padding = 0.05;
				break;

			case "bosanowa":
				padding = ui.menuconfig.get("disptype_bosanowa") !== 2 ? 0.5 : 0.05;
				break;

			default:
				padding = 0.5;
				break;
		}
		if (ui.menuconfig.get("fullwidth")) {
			padding = 0;
		}
		return padding;
	},

	//--------------------------------------------------------------------------------
	// ui.selectStr()  現在の言語に応じた文字列を返す
	//--------------------------------------------------------------------------------
	selectStr: function(strJP, strEN) {
		if (!strEN) {
			return strJP;
		}
		return pzpr.lang === "ja" ? strJP : strEN;
	},

	//---------------------------------------------------------------------------
	// ui.getCurrentConfigList() 現在のパズルで有効な設定と設定値を返す
	//---------------------------------------------------------------------------
	getCurrentConfigList: function() {
		return ui.menuconfig.getList();
	},

	//----------------------------------------------------------------------
	// ui.initFileReadMethod() ファイルアクセス関連の処理の初期化を行う
	//----------------------------------------------------------------------
	initFileReadMethod: function() {
		// File Reader (あれば)の初期化処理
		if (typeof FileReader !== "undefined") {
			this.reader = new FileReader();
			this.reader.onload = function(e) {
				ui.puzzle.open(e.target.result);
			};
			this.enableReadText = true;
		} else {
			this.reader = null;
			this.enableGetText =
				typeof FileList !== "undefined" &&
				typeof File.prototype.getAsText !== "undefined";
		}
	},

	//----------------------------------------------------------------------
	// ui.initImageSaveMethod() 画像保存関連の処理の初期化を行う
	//----------------------------------------------------------------------
	initImageSaveMethod: function(puzzle) {
		if (
			!!pzpr.Candle.enable.canvas &&
			!!_doc.createElement("canvas").toDataURL
		) {
			this.enableImageType.png = true;

			var canvas = _doc.createElement("canvas");
			canvas.width = canvas.height = 1;
			if (canvas.toDataURL("image/gif").match("image/gif")) {
				this.enableImageType.gif = true;
			}
			if (canvas.toDataURL("image/jpeg").match("image/jpeg")) {
				this.enableImageType.jpeg = true;
			}
			if (canvas.toDataURL("image/webp").match("image/webp")) {
				this.enableImageType.webp = true;
			}
		}
		if (!!pzpr.Candle.enable.svg && !!window.btoa) {
			this.enableImageType.svg = true;
		}
		if (!!this.enableImageType.png || !!this.enableImageType.svg) {
			this.enableSaveImage = true;
		}

		this.enableSaveBlob = !!window.navigator.saveBlob;
	}
};

// Event.js v3.4.0
/* global _doc:readonly */

//---------------------------------------------------------------------------
// ★UIEventsクラス イベント設定の管理を行う
//---------------------------------------------------------------------------
// メニュー描画/取得/html表示系
ui.event = {
	resizetimer: null, // resizeタイマー
	visibilitystate: null,

	visibilityCallbacks: [],

	removers: [],

	//----------------------------------------------------------------------
	// event.addEvent()        addEventListener(など)を呼び出す
	//----------------------------------------------------------------------
	addEvent: function(el, event, self, callback, capt) {
		this.removers.push(pzpr.util.addEvent(el, event, self, callback, !!capt));
	},

	//----------------------------------------------------------------------
	// event.removeAllEvents() addEventで登録されたイベントを削除する
	//----------------------------------------------------------------------
	removeAllEvents: function() {
		this.removers.forEach(function(remover) {
			remover();
		});
		this.removers = [];
	},

	addVisibilityCallback: function(callback) {
		if (this.visibilitystate === "visible") {
			callback();
		} else {
			this.visibilityCallbacks.push(callback);
		}
	},

	//---------------------------------------------------------------------------
	// event.setWindowEvents()  マウス入力、キー入力以外のイベントの設定を行う
	//---------------------------------------------------------------------------
	setWindowEvents: function() {
		// File API＋Drag&Drop APIの設定
		if (!!ui.reader) {
			var DDhandler = function(e) {
				ui.reader.readAsText(e.dataTransfer.files[0]);
				e.preventDefault();
				e.stopPropagation();
			};
			this.addEvent(
				window,
				"dragover",
				this,
				function(e) {
					e.preventDefault();
				},
				true
			);
			this.addEvent(window, "drop", this, DDhandler, true);
		}

		// onBlurにイベントを割り当てる
		this.addEvent(_doc, "blur", this, this.onblur_func);

		// onresizeイベントを割り当てる
		var evname = !pzpr.env.OS.iOS ? "resize" : "orientationchange";
		this.addEvent(window, evname, this, this.onresize_func);

		// onbeforeunloadイベントを割り当てる
		this.addEvent(window, "beforeunload", this, this.onbeforeunload_func);

		// onunloadイベントを割り当てる
		this.addEvent(window, "unload", this, this.onunload_func);

		if (!!matchMedia) {
			var mqString = "(resolution: 1dppx)";
			matchMedia(mqString).addListener(this.onpixelratiochange_func);
		}
	},

	setDocumentEvents: function() {
		this.addEvent(
			document,
			"visibilitychange",
			this,
			this.onvisibilitychange_func
		);
		this.onvisibilitychange_func(); // set state
	},

	//---------------------------------------------------------------------------
	// event.onload_func()   ウィンドウを開いた時に呼ばれる関数
	// event.onunload_func() ウィンドウをクローズする前に呼ばれる関数
	//---------------------------------------------------------------------------
	onload_func: function(onload_option) {
		ui.initFileReadMethod();

		ui.urlconfig.init(onload_option);
		ui.menuconfig.restore();

		ui.listener.setListeners(ui.puzzle);

		if (pzpr.env.OS.Android) {
			ui.misc.modifyCSS({
				"body, .btn": { fontFamily: "Verdana, Arial, sans-serif" }
			});
		}
	},
	onunload_func: function() {
		ui.menuconfig.save();
	},

	//---------------------------------------------------------------------------
	// event.onresize_func() ウィンドウリサイズ時に呼ばれる関数
	// event.onblur_func()   ウィンドウからフォーカスが離れた時に呼ばれる関数
	// event.onbeforeunload_func()  ウィンドウをクローズする前に呼ばれる関数
	//---------------------------------------------------------------------------
	onresize_func: function() {
		if (this.resizetimer) {
			clearTimeout(this.resizetimer);
		}
		this.resizetimer = setTimeout(function() {
			ui.adjustcellsize();
		}, 250);
	},
	onblur_func: function() {
		ui.puzzle.key.keyreset();
		ui.puzzle.mouse.mousereset();
	},
	onbeforeunload_func: function(e) {
		if (ui.puzzle.playeronly || !ui.puzzle.ismodified()) {
			return;
		}

		var msg = ui.selectStr("盤面が更新されています", "The board is edited.");
		e.returnValue = msg;
		return msg;
	},

	onvisibilitychange_func: function(e) {
		var state = document.visibilityState;
		if (state !== this.visibilitystate) {
			this.visibilitystate = state;
			if (state === "visible") {
				for (var i = 0; i < this.visibilityCallbacks.length; i++) {
					this.visibilityCallbacks[i]();
				}
				this.visibilityCallbacks = [];
			}
		}
	},

	onpixelratiochange_func: function(e) {
		ui.puzzle.redraw(true);
	}
};

// Listener.js v3.4.1

//---------------------------------------------------------------------------
// ★UIListener Puzzleに付加するListenerイベント設定の管理を行う
//  注意：execListenerで呼び出される関数は、thisがui.listenerになっていません
//---------------------------------------------------------------------------
ui.listener = {
	//---------------------------------------------------------------------------
	// listener.setListeners()  PuzzleのListenerを登録する
	//---------------------------------------------------------------------------
	setListeners: function(puzzle) {
		puzzle.once("ready", this.onFirstReady);
		puzzle.on("ready", this.onReady);

		puzzle.on("key", this.onKeyInput);
		puzzle.on("mouse", this.onMouseInput);
		puzzle.on("history", this.onHistoryChange);
		puzzle.on("trial", this.onTrialModeChange);
		puzzle.on("mode", this.onModeChange);

		puzzle.on("adjust", this.onAdjust);
		puzzle.on("resize", this.onResize);

		puzzle.on("cellop", this.onCellOp);
	},

	//---------------------------------------------------------------------------
	// listener.onFirstReady() 初回のパズル読み込み完了時に呼び出される関数
	// listener.onReady()  パズル読み込み完了時に呼び出される関数
	//---------------------------------------------------------------------------
	onFirstReady: function(puzzle) {
		ui.initImageSaveMethod(puzzle);
		ui.timer.init();
	},
	onReady: function(puzzle) {
		/* パズルの種類が同じならMenuArea等の再設定は行わない */
		if (ui.currentpid !== puzzle.pid) {
			/* 以前設定済みのイベントを削除する */
			ui.event.removeAllEvents();

			/* menuareaより先に キーポップアップを作成する必要がある */
			ui.keypopup.create();

			/* メニュー用の設定を消去・再設定する */
			ui.menuarea.reset();
			ui.toolarea.reset();
			ui.popupmgr.reset();
			ui.notify.reset();
			ui.misc.displayDesign();

			/* Windowへのイベント設定 */
			ui.event.setWindowEvents();
			ui.event.setDocumentEvents();
		}

		ui.menuconfig.sync();
		ui.menuconfig.set(
			"autocheck_once",
			ui.menuconfig.get("autocheck_mode") !== "off" && ui.puzzle.playeronly
		);
		ui.currentpid = puzzle.pid;

		ui.adjustcellsize();
		ui.keypopup.display();

		ui.event.addVisibilityCallback(function() {
			ui.timer.start();
		});

		ui.network.start();
	},

	//---------------------------------------------------------------------------
	// listener.onKeyInput()    キー入力時に呼び出される関数 (return false = 処理をキャンセル)
	// listener.onMouseInput()  盤面へのマウス入力時に呼び出される関数 (return false = 処理をキャンセル)
	//---------------------------------------------------------------------------
	onKeyInput: function(puzzle, c) {
		var kc = puzzle.key,
			ut = ui.undotimer,
			result = true;
		if (kc.keydown) {
			/* TimerでUndo/Redoする */
			if (c === "ctrl+z" || c === "meta+z") {
				ut.startUndo();
				result = false;
			}
			if (c === "ctrl+y" || c === "meta+y") {
				ut.startRedo();
				result = false;
			}

			/* F2で回答モード Shift+F2で問題作成モード */
			if (!puzzle.playeronly) {
				if (puzzle.editmode && c === "F2") {
					ui.menuconfig.set("mode", puzzle.MODE_PLAYER);
					result = false;
				} else if (puzzle.playmode && c === "shift+F2") {
					ui.menuconfig.set("mode", puzzle.MODE_EDITOR);
					result = false;
				}
			}
		} else if (kc.keyup) {
			/* TimerのUndo/Redoを停止する */
			ut.stop();
		}

		kc.cancelEvent = !result;
	},
	onMouseInput: function(puzzle) {
		var mv = puzzle.mouse,
			result = true;
		if (mv.mousestart && mv.btn === "middle") {
			/* 中ボタン */
			ui.menuconfig.set("mode", puzzle.playmode ? "edit" : "play");
			mv.mousereset();
			result = false;
		}

		mv.cancelEvent = !result;
	},

	//---------------------------------------------------------------------------
	// listener.onHistoryChange() 履歴変更時に呼び出される関数
	// listener.onTrialModeChange() 仮置きモード変更時に呼び出される関数
	// listener.onModeChange()      Mode変更時に呼び出される関数
	//---------------------------------------------------------------------------
	onHistoryChange: function(puzzle) {
		if (!!ui.currentpid) {
			ui.setdisplay("operation");
		}
	},
	onTrialModeChange: function(puzzle, trialstage) {
		if (!!ui.currentpid) {
			ui.setdisplay("trialmode");
		}
	},
	onModeChange: function(puzzle) {
		ui.menuconfig.list.mode.val = ui.puzzle.playmode ? "play" : "edit";
		ui.setdisplay("mode");
		ui.menuconfig.set("inputmode", ui.puzzle.mouse.inputMode);

		ui.setdisplay("keypopup");
		ui.setdisplay("bgcolor");
		for (var key in ui.puzzle.config.getVariants()) {
			ui.setdisplay(key);
		}
		ui.keypopup.display();
	},

	//---------------------------------------------------------------------------
	// listener.onAdjust()  盤面の大きさが変わったときの処理を呼び出す
	//---------------------------------------------------------------------------
	onAdjust: function(puzzle) {
		ui.adjustcellsize();
	},

	//---------------------------------------------------------------------------
	// listener.onResize()  canvasのサイズを変更したときの処理を呼び出す
	//---------------------------------------------------------------------------
	onResize: function(puzzle) {
		var pc = puzzle.painter,
			cellsize = Math.min(pc.cw, pc.ch);
		var val = (ui.getBoardPadding() * cellsize) | 0,
			valTop = val;
		if (puzzle.pid === "starbattle" || puzzle.pid === "easyasabc") {
			valTop = ((0.05 * cellsize) | 0) + "px";
		}
		puzzle.canvas.parentNode.style.padding = val + "px";
		puzzle.canvas.parentNode.style.paddingTop = valTop + "px";

		ui.keypopup.resizepanel();
	},

	onCellOp: function(puzzle, op) {
		ui.network.onCellOp(op);
	}
};

// MenuConfig.js v3.4.1

(function() {
	//---------------------------------------------------------------------------
	// ★MenuConfigクラス UI側の設定値を管理する
	//---------------------------------------------------------------------------
	var Config = pzpr.Puzzle.prototype.Config.prototype;

	// メニュー描画/取得/html表示系
	// Menuクラス
	ui.menuconfig = {
		list: null, // MenuConfigの設定内容を保持する
		puzzle: null,

		//---------------------------------------------------------------------------
		// menuconfig.init()  MenuConfigの初期化を行う
		// menuconfig.add()   初期化時に設定を追加する
		//---------------------------------------------------------------------------
		init: function() {
			this.list = {};

			/* 正解自動判定機能 */
			this.add("autocheck_mode", "guarded", {
				option: ["off", "simple", "guarded"]
			});

			/* per-solve autocheck status, turned off when complete */
			this.add("autocheck_once", ui.puzzle.playeronly, {
				volatile: true
			});

			this.add("keypopup", false); /* キーポップアップ (数字などのパネル入力) */

			this.add("adjsize", true); /* 自動横幅調節 */
			this.add(
				"cellsizeval",
				ui.windowWidth() <= 960 ? 36 : 48
			); /* セルのサイズ設定用 */
			this.add(
				"fullwidth",
				ui.windowWidth() < 600
			); /* キャンバスを横幅いっぱいに広げる */

			this.add("toolarea", true); /* ツールエリアの表示 */

			this.add("inputmode", "auto", { volatile: true }); /* inputMode */
			this.add("auxeditor_inputmode", "auto", { volatile: true });

			this.add("lrinvert", false, {
				volatile: true
			}); /* マウスの左右ボタンを反転する設定 */

			this.add("language", pzpr.lang, { option: ["en", "ja"] }); /* 言語設定 */

			/* puzzle.configを一括で扱うため登録 */
			this.puzzle = ui.puzzle;
			for (var name in ui.puzzle.config.list) {
				var item = ui.puzzle.config.list[name],
					extoption = { puzzle: true };
				for (var field in item.extoption) {
					extoption[field] = item[field];
				}
				this.add(name, item.defval, extoption);
			}
			this.add("mode", !ui.puzzle.playmode ? "edit" : "play", {
				option: ["edit", "play"],
				puzzle: true
			});
		},
		add: function(name, defvalue, extoption) {
			Config.add.call(this, name, defvalue, extoption);
			if (!!extoption && extoption.puzzle) {
				var item = this.list[name];
				item.volatile = item.puzzle = true;
			}
		},

		//---------------------------------------------------------------------------
		// menuconfig.sync()  URL形式などによって変化する可能性がある設定値を同期する
		//---------------------------------------------------------------------------
		sync: function() {
			var idname = null;
			switch (ui.puzzle.pid) {
				case "yajilin":
					idname = "disptype_yajilin";
					break;
				case "bosanowa":
					idname = "disptype_bosanowa";
					break;
				case "interbd":
					idname = "disptype_interbd";
					break;
				case "arukone":
					idname = "dontpassallcell";
					break;
				case "aquarium":
					idname = "aquarium_regions";
					break;
				case "country":
					idname = "country_empty";
					break;
			}
			if (!!idname) {
				this.set(idname, ui.puzzle.getConfig(idname));
			}

			this.set("variant", ui.puzzle.getConfig("variant"));
			this.set("lrinvert", ui.puzzle.mouse.inversion);
			this.set("autocmp", ui.puzzle.getConfig("autocmp"));
			this.set("autoerr", ui.puzzle.getConfig("autoerr"));
		},

		//---------------------------------------------------------------------------
		// menuconfig.getCurrentName()  指定されたidを現在使用している名前に変換する
		//---------------------------------------------------------------------------
		getCurrentName: Config.getCurrentName,
		getNormalizedName: Config.getNormalizedName,

		//---------------------------------------------------------------------------
		// menuconfig.get()  各フラグの設定値を返す
		// menuconfig.get()  各フラグの設定値を返す
		// menuconfig.reset() 各フラグの設定値を初期化する
		//---------------------------------------------------------------------------
		get: Config.get,
		set: function(argname, newval) {
			var names = this.getNormalizedName(argname),
				idname = names.name;
			if (!this.list[idname]) {
				return;
			}

			if (idname === "mode" || idname === "inputmode") {
				if (ui.popupmgr.popups.auxeditor.pop) {
					ui.popupmgr.popups.auxeditor.close();
				}
			}

			if (idname === "mode") {
				ui.puzzle.setMode(newval);
				newval = !ui.puzzle.playmode ? "edit" : "play";
			} else if (idname === "inputmode") {
				ui.puzzle.mouse.setInputMode(newval);
				newval = ui.puzzle.mouse.inputMode;
			} else if (idname === "auxeditor_inputmode") {
				ui.auxeditor.puzzle.mouse.setInputMode(newval);
				newval = ui.auxeditor.puzzle.mouse.inputMode;
			}

			newval = this.setproper(names, newval);

			if (idname === "language") {
				pzpr.lang = newval;
			} else if (this.list[idname].puzzle) {
				ui.puzzle.setConfig(argname, newval);
			}

			this.configevent(idname, newval);
		},
		reset: Config.reset,

		//---------------------------------------------------------------------------
		// menuconfig.restore()  保存された各種設定値を元に戻す
		// menuconfig.save()     各種設定値を保存する
		//---------------------------------------------------------------------------
		restore: function() {
			/* 設定が保存されている場合は元に戻す */
			ui.puzzle.config.init();
			this.init();
			var json_puzzle = localStorage["pzprv3_config:puzzle"];
			var json_menu = localStorage["pzprv3_config:ui"];
			if (!!json_puzzle) {
				this.setAll(JSON.parse(json_puzzle));
			}
			if (!!json_menu) {
				this.setAll(JSON.parse(json_menu));
			}
		},
		save: function() {
			localStorage["pzprv3_config:puzzle"] = JSON.stringify(
				ui.puzzle.saveConfig()
			);
			localStorage["pzprv3_config:ui"] = JSON.stringify(this.getAll());
		},

		//---------------------------------------------------------------------------
		// menuconfig.getList()  現在有効な設定値のリストを返す
		//---------------------------------------------------------------------------
		getList: Config.getList,
		getexec: function(name) {
			if (!this.list[name]) {
				return false;
			}
			if (name === "mode") {
				return !ui.puzzle.playeronly;
			} else if (this.list[name].puzzle) {
				return ui.puzzle.validConfig(name);
			}
			return true;
		},

		//---------------------------------------------------------------------------
		// menuconfig.getAll()  全フラグの設定値を返す
		// menuconfig.setAll()  全フラグの設定値を設定する
		//---------------------------------------------------------------------------
		getAll: Config.getAll,
		setAll: function(setting) {
			for (var key in setting) {
				this.set(key, setting[key]);
			}
			this.list.autocheck_once.val = this.list.autocheck_mode.val !== "off";
		},

		//---------------------------------------------------------------------------
		// menuconfig.setproper()    設定値の型を正しいものに変換して設定変更する
		// menuconfig.valid()        設定値が有効なパズルかどうかを返す
		//---------------------------------------------------------------------------
		setproper: Config.setproper,
		valid: function(idname) {
			if (!this.list[idname]) {
				return false;
			}
			if (idname === "keypopup") {
				return ui.keypopup.paneltype[1] !== 0 || ui.keypopup.paneltype[3] !== 0;
			} else if (idname === "mode") {
				return !ui.puzzle.playeronly;
			} else if (idname === "inputmode") {
				return (
					ui.puzzle.mouse.getInputModeList("play").length > 1 ||
					(!ui.puzzle.playeronly &&
						ui.puzzle.mouse.getInputModeList("edit").length > 1)
				);
			} else if (idname === "autocheck_mode" || idname === "autocheck_once") {
				return ui.puzzle.playeronly && !ui.puzzle.getConfig("variant");
			} else if (this.list[idname].puzzle) {
				return ui.puzzle.validConfig(idname);
			}
			return true;
		},

		//---------------------------------------------------------------------------
		// config.configevent()  設定変更時の動作を記述する (modeはlistener.onModeChangeで変更)
		//---------------------------------------------------------------------------
		configevent: function(idname, newval) {
			if (!ui.menuarea.menuitem) {
				return;
			}
			ui.setdisplay(idname);
			switch (idname) {
				case "keypopup":
					ui.keypopup.display();
					break;

				case "adjsize":
				case "cellsizeval":
				case "fullwidth":
					ui.adjustcellsize();
					break;

				case "autocheck_mode":
					this.list.autocheck_once.val = newval !== "off";
					break;

				case "language":
					ui.displayAll();
					break;

				case "lrinvert":
					ui.puzzle.mouse.setInversion(newval);
					break;
			}
		}
	};
})();

(function() {
	ui.urlconfig = {
		embed: false,

		init: function(onload_option) {
			if (onload_option.embed === "yes") {
				this.embed = true;
			}
		}
	};
})();

// Misc.js v3.4.1
/* global _doc:readonly */

//---------------------------------------------------------------------------
// ★Miscクラス html表示系 (Menu, Button以外)の制御を行う
//---------------------------------------------------------------------------
ui.misc = {
	//---------------------------------------------------------------------------
	// misc.displayDesign()  背景画像とかtitle・背景画像・html表示の設定
	// misc.bgimage()        背景画像を返す
	//---------------------------------------------------------------------------
	displayDesign: function() {
		var pid = ui.puzzle.pid;
		var pinfo = pzpr.variety(pid);
		var title = ui.selectStr(pinfo.ja, pinfo.en);
		title += ui.puzzle.playeronly
			? " player"
			: ui.selectStr(" エディタ", " editor");

		_doc.title = title;
		var titleEL = _doc.getElementById("title2");
		titleEL.innerHTML = title;

		if (ui.urlconfig.embed) {
			_doc.body.style.background = "white";
		} else {
			_doc.body.style.backgroundImage = "url(" + this.bgimage(pid) + ")";
		}
	},
	bgimage: function(pid) {
		return toBGimage(pid);
	},

	//--------------------------------------------------------------------------------
	// misc.modifyCSS()   スタイルシートの中身を変更する
	//--------------------------------------------------------------------------------
	modifyCSS: function(input) {
		var sheet = _doc.styleSheets[0];
		var rules = sheet.cssRules;
		if (rules === null) {
		} // Chromeでローカルファイルを開くとおかしくなるので、とりあえず何もしないようにします
		else if (!this.modifyCSS_sub(rules, input)) {
			var sel = "";
			for (sel in input) {
				break;
			}
			sheet.insertRule("" + sel + " {}", rules.length);
			rules = sheet.cssRules;
			this.modifyCSS_sub(rules, input);
		}
	},
	modifyCSS_sub: function(rules, input) {
		var modified = false;
		for (var i = 0, len = rules.length; i < len; i++) {
			var rule = rules[i];
			if (!rule.selectorText) {
				continue;
			}
			var pps = input[rule.selectorText];
			if (!!pps) {
				for (var p in pps) {
					if (!!pps[p]) {
						rule.style[p] = pps[p];
					}
				}
				modified = true;
			}
		}
		return modified;
	},

	//--------------------------------------------------------------------------------
	// misc.walker()        DOMツリーをたどる
	// misc.displayByPid()  要素のdata-pid, autocmp-typeカスタム属性によって表示するしないを切り替える
	//--------------------------------------------------------------------------------
	walker: function(parent, func) {
		var els = [parent.firstChild];
		while (els.length > 0) {
			var el = els.pop();
			func(el);
			if (!!el.nextSibling) {
				els.push(el.nextSibling);
			}
			if (el.nodeType === 1 && el.childNodes.length > 0) {
				els.push(el.firstChild);
			}
		}
	},
	displayByPid: function(parent) {
		ui.misc.walker(parent, function(el) {
			if (el.nodeType === 1) {
				var disppid = ui.customAttr(el, "dispPid");
				if (!!disppid) {
					el.style.display = pzpr.util.checkpid(disppid, ui.puzzle.pid)
						? ""
						: "none";
				}
				var autocmp = ui.customAttr(el, "autocmpType");
				if (!!autocmp) {
					el.style.display =
						ui.puzzle.painter.autocmp === autocmp ? "" : "none";
				}
			}
		});
	}
};

function toBGimage(pid) {
	var imgs = [
		"angleloop",
		"aquarium",
		"araf",
		"skyscrapers",
		"balance",
		"castle",
		"compass",
		"curvedata",
		"dbchoco",
		"detour",
		"doppelblock",
		"doubleback",
		"easyasabc",
		"geradeweg",
		"heteromino",
		"kropki",
		"maxi",
		"midloop",
		"moonsun",
		"nondango",
		"nonogram",
		"nurimisaki",
		"pencils",
		"satogaeri",
		"scrin",
		"simpleloop",
		"snake",
		"starbattle",
		"symmarea",
		"tapaloop",
		"tents",
		"walllogic",
		"yinyang"
	];
	if (imgs.indexOf(pid) >= 0) {
		return "img/" + pid + ".png";
	}
	var header;
	var data = {
		/* カラーパレットが2色時のHeader(途中まで), 16×16サイズのData Block(途中から) */
		aho: ["ICAgKCgoC", "I4Qdp3vJDxwMtNorV85sQ6RwWhhiZPNF57Q+3udgcjWmLVMAADs="],
		amibo: ["P/AwP///y", "HoRjqQvI36AKtNrrolx5Hz+BXjeKX4KlVWmSmyt1BQA7"],
		ayeheya: ["P/ow////y", "F4SPGJEN66KctNoGaZ5b9guGIsdoZVUAADs="],
		cave: [
			"P+vg///wC",
			"JYRjl4DbmlqYtNr3mFs67g+FYiZd5uSlYjdyJNim56mytv3CeQEAOw=="
		],
		barns: [
			"MDAwID//y",
			"JQyCqZa369hTDtg7cYxT+r51zUVyWSMiYbqKJZl65tOCqDHjZQEAOw=="
		],
		bdblock: [
			"Dn/pP///y",
			"IoyPqQHb+lJE81RzmdsMeI994EKWJsVJKQqtlouFovydSgEAOw=="
		],
		bonsan: [
			"P//wMD/wC",
			"JoSPicGqcWCSgBpbJWa81zlR4hNizomeHMh+1wZ2MtssrTmmmVQAADs="
		],
		box: ["ICAgKCgoC", "IgyOCaadxpyKEkHqKH5tLxmEondg5MeBU2WyKziGakfPRwEAOw=="],
		cbblock: ["P/QQf///y", "H4wDp3vJj+BzUlEIst784rp4lSiRH9igKdNpk2qYRwEAOw=="],
		chocona: ["P/AwP///y", "IIyPGcDtD1BUM1WpVr6HG69R2yiWFnmamNqh0Ntk8iwXADs="],
		cojun: [
			"MD//////y",
			"I4wfgMvKD+Jrcp6IrcF18ux9DiWOSNldaJqspgu28AZndVYAADs="
		],
		country: ["P/Gif///y", "IISPGZFtDKB7SDZL78RYna6BjhhO1WdG3siubWZC5FkAADs="],
		creek: [
			"AD//8H+/y",
			"JIQfGces2tyD8RkrU16XboBVExd1YTmSjXWa5NlirTsjU/k1BQA7"
		],
		factors: ["AD//////y", "IISPqcsWHxp4iKq4cGXayd5dWwN+SXigqHeBawpJ8pwUADs="],
		fillmat: [
			"P//wLP/gS",
			"JoSDAam2yh6SM9pbE4UaT3d0HrWRmDOiXMZ+oLfG5cjIMAnOIlsAADs="
		],
		fillomino: [
			"ODg4P///y",
			"I4QPgcvKn4KU0DhbE7qP3wl608FtDVRq3bkuYZillYxmLlQAADs="
		],
		firefly: [
			"ID/gP//wC",
			"JISDpqvRzNySME2EMaAHzuddXEiWlVVSYxRl7riCsqeaG2orBQA7"
		],
		fivecells: [
			"MD/wP///y",
			"IwyOmWbqDaCLCgY7T5NT8vV02fdpYpVRSAmqZ4S145rS7FMAADs="
		],
		fourcells: [
			"MD/wP///y",
			"JoSPELeZrdxjoUJbmTYQ3T1xoEdh1gh+jhqtaZlxGOqK0nvL5o4VADs="
		],
		goishi: [
			"P/zwf///y",
			"JoSPiRHK2UA0cU5JVz5V79stFzUq5oly5eOBG8a9sAu/4QetZXoUADs="
		],
		gokigen: ["OD/g////y", "HYQPgafbvlKUMD42r9HbZg9W4oh9IdmZaLpSLZcUADs="],
		hakoiri: [
			"MD//////y",
			"KISPicEa+UyUYE5KLcSVY81FVyc1JYMq6oKm6zgu2zur8Eoesd6aSgEAOw=="
		],
		hanare: ["AD//////y", "FYSPqcvtDyMMdNLqLm46WC+F4kgmBQA7"],
		hashikake: [
			"P///8DAwC",
			"JoQflse829qLMlhLVYQuw8s5F+JtpTJSIKm2UgaAGBxrdI3TU1MAADs="
		],
		hebi: ["ID/gMD/wC", "FISPqcvtD1WYtM6Is96825pcHVQAADs="],
		herugolf: [
			"MD//+H//y",
			"I4SPiRHqwJ6KcrV6KIbXdqNlITeNo3Q+zMo67Ou+ayx/G1IAADs="
		],
		heyabon: [
			"P//wMD/wC",
			"LYyPacDtH9p5LgJ7IYt4V559Clh9Idad0kJ57caimmex7nqNUN2lti8JvSaAAgA7"
		],
		heyawake: ["MD/wP///y", "F4SPGJEN66KctNoGaZ5b9guGIsdoZVUAADs="],
		hitori: ["P//QP///y", "H4SPFhvpwNpDcVJ2lz11Q+x1HgduonVOZ/qwjpvASAEAOw=="],
		icebarn: ["EH9/////y", "F4SPqcvt3wJEcpp6g95cW/yAjmiV5nkWADs="],
		icelom: ["EH9/////y", "GYSPqcvdAYOblMl1UU7b9PN9XkWSkVimaQEAOw=="],
		icelom2: ["H///////y", "G4SPqcvNEQxsMVX71MWue7SBWjZyywSg38o2BQA7"],
		ichimaga: ["ODg4P///y", "IIyPGcDtfZ4EUdmLzWRxQ+1kovh0HgVO42qhy+nCHBsUADs="],
		ichimagam: ["ODg4P///y", "F4yPGcDtD6NTtFojs3639w1m3kiW5lUAADs="],
		ichimagax: ["ODg4P///y", "HkSOicDtDyNUtNHKltzcXXsloNKVm2aEqHqYbsQuBQA7"],
		juosan: ["Pjzu9/bqC", "H4SPEMm43R5MUoWLZZ1mcz+BIDRGHHU6ToYdJfOiZwEAOw=="],
		kaero: [
			"P/A/////y",
			"KIyPecDtbUB4dE5JIbtSxa1VISaC5sOlmXo6LImOnCt77BxjuPhlbgEAOw=="
		],
		kazunori: [
			"KD/wND/4C",
			"IwyOqaaN7BqMKdiL86xU9vVx4bEtFklBRglcj4a1T0qe9AgUADs="
		],
		kakuro: ["ICAgP///y", "F4SPqcut4V5McJ5qAbZ79vg5YTNmZlYAADs="],
		kakuru: ["MD/wP///y", "HYSPqcut4QA8c1Vq2ZWu7vxpERYmXmeKz6oaJVUAADs="],
		kinkonkan: [
			"P//gP///y",
			"JoSDAanmrKBbsDaL7ctoUuwdjBhSWxdyHod+bObCZyetiVuOo1MAADs="
		],
		kouchoku: ["ODg4P///y", "IIwDp3vJbxxccqraMKK6xX4BYDh+0SRSTLparevBsVwVADs="],
		kramma: ["ID/gMD/wC", "IISPGJFt6xqMitEzL8hv+Q+G4idZGkehkeqwpdbBj7wVADs="],
		kramman: ["ID/gMD/wC", "GYSPqcvtj4IMb85mbcy8+7xxGOho0ImmaQEAOw=="],
		kurochute: [
			"PDw8ODg4C",
			"IYSPFpGty9yBUD5qb9QVrER1GTaSUvWdadqILCKW2UzTBQA7"
		],
		kurodoko: ["ICAgMDAwC", "H4SPiRHqDaAzMk66Lraa1g6GIhNCn1Kd2aGubUKKSAEAOw=="],
		kurotto: [
			"MDAwODg4C",
			"KYxvoKuIzNKSD8gWMM2T12t5h+ZAncOZaoiu6LZFYtyRmGyHuPqmUF8AADs="
		],
		kusabi: [
			"MD/wP///y",
			"I4SPqZvh/06QaxoLMMK80uuBYvaRY3eWW6mxqjuuJwQx9r0UADs="
		],
		lightup: ["MD//////y", "IIRvgcvKDxycNAY5r6a6I99t2xdijVeN1bqYHJvA0VMAADs="],
		lits: ["ICAgKCgoC", "IYQRqXmNq9yBUT7alr1wU2Z9gfeRWFiip6RNKfs6otkdBQA7"],
		lookair: ["AD//6D//y", "GoSPqcsa/5qBUdIgwc07+w92jciQi+lQYFYAADs="],
		loopsp: [
			"P+AgP/Pgy",
			"KYwPeLtpzoCcVDb1Mg7QQb55T9VVGrOBaPqhHomY6iyG2EfCa7dep1EAADs="
		],
		loute: ["IH/gf///y", "IYyPaaDB+lJE89TVrssZ+Ph5zUiWG8ShqpSyK9V9Vmg2BQA7"],
		makaro: [
			"NnZ2e3t7S",
			"I0xgmYDqytpzUa6K7cl1wuh9lnZ93siEompwoOhSHTuz26kUADs="
		],
		mashu: [
			"P/AwP///y",
			"JoR/kRntvYxCFExb6b0ZS/Y4kdeRXLaVViqFJ1vCndw+oziP+QcUADs="
		],
		mejilink: [
			"NDQ0P///y",
			"JoxheZrI4VhUE9iLc5ztQc8tz9ZBpPiN4Kq2hwZbpcTS7lk1zlYAADs="
		],
		minarism: ["AD//4H+/y", "HYyPqcutAKN8DNBlU75oa/6FoOF141EG0po67vsWADs="],
		mochikoro: [
			"AAAAICAgC",
			"IYwDqXmNq9yBUT7alr1wU2Z9gPeRWFiip6RNKfs6otkdBQA7"
		],
		mochinyoro: ["MDAwKCgoC", "FoSPqct9AaOctNqLs4au+29s4kiWUwEAOw=="],
		nagare: ["N/Z/+7r/y", "H4SPEJtt7FqItFo678t3ceWF4iGWIWim6sqirbtubQEAOw=="],
		nagenawa: [
			"ACAgACeoC",
			"JYSPacHdCgKUiiaL8NFrO7eF3RiJJWml5geS2QRX8TWxDITnegEAOw=="
		],
		nanro: ["MD//+H//y", "IIQfGcet2+KLUlFnL8rs+Q+G4khOWKJtaAqYqavBlwwUADs="],
		nawabari: [
			"MD//////y",
			"IwRihsnK2xI88dnqJM68zhl9G6V5wYmmagc24vZisavWKYsVADs="
		],
		norinori: [
			"P/d1MDAwC",
			"I4QfGcet2+KLUlFn8USvJ+Z5YLgZogZdZqYCpfpeMTVXX1MAADs="
		],
		numlin: [
			"MDAwP///y",
			"JYyBaJG6Cx6UhzIbacuszaphYkhKG+SVD7eOJpZ2yXepdGuDRgEAOw=="
		],
		nuribou: [
			"KCgoICAgC",
			"JYQRGYfKug58TlYzbaJbR3w1HTiKn8mdGamGK+ql6Uu7dlnjYQEAOw=="
		],
		nurikabe: ["P+hof/R0S", "FoSPqcvtD1eY1NHa7rSaX49F4kiWTAEAOw=="],
		nurimaze: [
			"MD/wP/0/y",
			"I4Qfp4u8aYKcs0WnINBYc+dRlIVtZHeCiMh6JfO9MSitbTwbBQA7"
		],
		paintarea: [
			"P//wMD/wC",
			"JowDCYfKug58TlYzbaJbR3w1HTiKn8lBZ5oxpOp6rTurIXvL+TsXADs="
		],
		pipelink: [
			"ID/gM//gy",
			"Kkxgqae4bYCcjs6YaoaY9a99BxWRz4mmi1VeW+d44Px6cWXhrHzG/OMoAAA7"
		],
		pipelinkr: [
			"ID//8D//y",
			"Kkxgqae4bYCcjs6YaoaY9a99BxWRz4mmi1VeW+d44Px6cWXhrHzG/OMoAAA7"
		],
		rectslider: [
			"MDAwODg4C",
			"IIxvoKuIzNyBa1Jqb5RB8359mseRkumMG6gCGSSGpSwVADs="
		],
		reflect: ["MDAwP///y", "HoyPqcvtCMAzMb5aWw5YbfpxVtKJEoONWrhO7gsnBQA7"],
		renban: [
			"ID/gP//wC",
			"JoRjeZrI4FhUM9h7F4yzPfh1mkRp2MmF6iOCLIVaZvrWpF16bnwVADs="
		],
		ringring: [
			"KCgoMDAwC",
			"JwRiqae4bYKctDr3Isw63dp1VsgcYCmeWDmirLpx6/p81n1xJL04BQA7"
		],
		ripple: ["AD//////y", "IIyBYJG6jRg8sNqLs97RyvZMnxNGo3liKce2XkuBVVAAADs="],
		roma: ["P/wwf///y", "IoSPqXvBGtxrcZpYJ85sc+hJYLiE2Ggm5oas7OWeQMzSWwEAOw=="],
		sashigane: ["IH/gf///y", "HYyPqcsBrcBrskp4LjZz+79p2NQxZRkhaOp4IhgUADs="],
		shakashaka: [
			"AAAAICAgC",
			"IoSPqRe7AR2CVAKKHd5q++l9VxgaJMecTXJqoltZ4ypfSwEAOw=="
		],
		shikaku: ["ICAgMDAwC", "HoSPGcm43YKctMoIcVab9/N8QPiRjoVe4riyq7kFBQA7"],
		shimaguni: ["P//wMD/wC", "G4yPqavgDx2KFMwKL5as+w+GBqVtJXZWqcgeBQA7"],
		shugaku: [
			"AAAQAAAgC",
			"JoRvoauIzNyBSyYaXp37Nv55GTiKGnWWQESmbguLrISp6ezUFlAAADs="
		],
		shwolf: ["ID/gMD/wC", "IQyOiQas6RqcytlXsY569RaE4vhx5Zedx5WulKuamNwFBQA7"],
		slalom: ["ID//////y", "IIwPecsJDIOLcNJlr3FP76yBF+d9SkmipydSbbWOsVEAADs="],
		slither: ["AAAAP///y", "F4yPqcutAF5MULqLs978Vjohnxh2ZlYAADs="],
		sudoku: ["P//wP///y", "HoRvgcvKDxxccp5qY0bY9hiE4khCn7ldabJq6/l8BQA7"],
		sukoro: [
			"MDAwODg4C",
			"JYyPoMin39KDMUwa76p2crd9HGaQF0hpQHeqrOe671p6KEOKSAEAOw=="
		],
		tapa: ["P+hof/R0S", "IISPqRAdm9yDR9LqrjY2ZvYhXSd+JNZs2gmxi6vAqlEAADs="],
		tasquare: ["ICAgGBgYC", "IYxvoKuIzNyBSyYKbMDZcv15HPaMzWR2l1mmFcrCYzsfBQA7"],
		tatamibari: ["LP/gf///y", "HYSPqaHA2x6SM9pETzbbwY9dFTiG5lmmzcq2rlIAADs="],
		tateyoko: ["P/AwP///y", "H4RjqQvI3+BzJ9hLqUx6R8+BXreRkoZhofiJJvROSgEAOw=="],
		tawa: ["MDAwODg4C", "GIR/gcud3hRccj57Mai6+8lZIeiNkOlwBQA7"],
		tentaisho: [
			"IWL/X23/y",
			"KASCYcum+5qDUx6mYtPZ3u19VZhooVWeBzJK5WNCr7jNsfOyXq6mQAEAOw=="
		],
		tilepaint: [
			"KCgoICAgC",
			"JowDCYfKug58TlYzbaJbR3w1HTiKn8lBZ5oxpOp6rTurIXvL+TsXADs="
		],
		toichika: [
			"ID/gP///y",
			"IoSPqRvsGlqSJlp6adXAwreE4nhwooeYWWlW6ZpObfeRYQEAOw=="
		],
		triplace: [
			"MD/wP///y",
			"JgyOCXas6dxrKNiLb51xv0593lJhI6ig0jlCZQabEzuHZH0v8V4AADs="
		],
		usotatami: [
			"MD/wP//wC",
			"KIQTppqcvc6BMKIKsIuZN10hjDdZnkguKNeV2ri+pQquKi2l9nulQAEAOw=="
		],
		wagiri: ["P/rw////y", "IIQPEci42dgzs1Ua77na7ShBoNR1YpilKmqtrOd+MVUAADs="],
		yajikazu: ["P/B/f///y", "HoSPEMm5DZ8JtNoKmcyTo+1loBh25YVSX3mMnMsyBQA7"],
		yajilin: ["MD/wP///y", "HISDicas2tpL0c1Qs968nwuGl0eWHqihmVqxRgEAOw=="],
		yajitatami: [
			"MD/wP//wC",
			"J4wPeRvpj9SbwLhG4WV8aZkpWBVWFkh1HHSSZTuGY7ypXYnSE/y2BQA7"
		],
		yosenabe: [
			"ODg/////y",
			"JIwDd6nGjdqD0VFZr5qg+4ltGgiKJkWO4bJ8nVhCT8yeq20dBQA7"
		],

		/* カラーパレットが3-4色時のHeader(途中まで), 16×16サイズのData Block(途中から) */
		bosanowa: [
			"P/AwP/hw////////y",
			"LowtAst5l1gTL6Q4r968e5VR0CUBToVJ55NOlQWqIhsvGv3l+j22/FgyzYAlRwEAOw=="
		],
		dosufuwa: [
			"JmZmbKysszMzP///y",
			"KUyAYMuW3lhCMJ6plMXZXu59TyiSpIAKZmqoXoq2L6y6EV3PeLifbFAAADs="
		],
		sukororoom: [
			"NDQ0ODg4PDw8P///y",
			"NIwfgqebBqJpS8X7nL0g18B1FNJgHukkwsqu6ZiioISYmzljN51LewfhZHBBICw2aSmXggIAOw=="
		],
		view: [
			"MD/wP//wP///////y",
			"LoQtEst5l1gTDykZXNq8+99hThWJFHlJ41OqJ5tOFdDKaAbmOnebc71YQWJBSgEAOw=="
		],
		wblink: [
			"NDQ0ODg4Pj4+P///y",
			"LoQdIct5l1gLDykpXNq8+99hThWJFHlJ41OqJ5tOFdDKaAbmOnebc71YQWJBSgEAOw=="
		]
	}[pid];

	/* 無い場合はimage.gifを返します */
	if (!data) {
		data = [
			"MD/wPD/8C",
			"KYQTpogKnFxbMDpa7W18yjhp1yGO1OidW5mSKFuaTyy585t0ctZ+EFAAADs="
		];
	}

	if (data[0].length <= 10) {
		header = "R0lGODdhEAAQAIAAA";
	} else {
		header = "R0lGODdhEAAQAKEAA";
	}

	return (
		"data:image/gif;base64," + header + data[0] + "wAAAAAEAAQAAAC" + data[1]
	);
}

// MenuArea.js v3.4.0
/* global getEL:readonly, _doc:readonly */

// メニュー描画/取得/html表示系
ui.menuarea = {
	captions: [], // 言語指定を切り替えた際のキャプションを保持する
	menuitem: null, // メニューの設定切り替え用エレメント等を保持する
	nohover: false, // :hover擬似クラスを使用しないでhover表示する

	//---------------------------------------------------------------------------
	// menuarea.reset()  メニュー、サブメニュー、フロートメニューの初期設定を行う
	//---------------------------------------------------------------------------
	reset: function() {
		this.createMenu();

		this.display();
	},

	//---------------------------------------------------------------------------
	// menuarea.createMenu()  メニューの初期設定を行う
	//---------------------------------------------------------------------------
	createMenu: function() {
		if (this.menuitem === null) {
			this.modifySelector();

			this.menuitem = {};
			this.walkElement(getEL("menupanel"));
		}
		ui.misc.displayByPid(getEL("menupanel"));
		this.stopHovering();
	},

	//---------------------------------------------------------------------------
	// menuarea.walkElement()  エレメントを探索して領域の初期設定を行う
	//---------------------------------------------------------------------------
	walkElement: function(parent) {
		var menuarea = this;
		function menufactory(role) {
			return function(e) {
				menuarea[role](e);
				if (menuarea.nohover) {
					e.preventDefault();
					e.stopPropagation();
				}
			};
		}
		function addmenuevent(el, type, role) {
			var func = typeof role === "function" ? role : menufactory(role);
			pzpr.util.addEvent(el, type, menuarea, func);
		}
		ui.misc.walker(parent, function(el) {
			if (el.nodeType === 1 && el.nodeName === "LI") {
				var setevent = false;
				var idname = ui.customAttr(el, "config");
				if (!!idname) {
					menuarea.menuitem[idname] = { el: el };
					if (el.className === "check") {
						addmenuevent(el, "mousedown", "checkclick");
						setevent = true;
					}
				}
				var value = ui.customAttr(el, "value");
				if (!!value) {
					var parent = el.parentNode.parentNode;
					idname = ui.customAttr(parent, "config");
					var item = menuarea.menuitem[idname];
					if (!item.children) {
						item.children = [];
					}
					item.children.push(el);

					addmenuevent(el, "mousedown", "childclick");
					setevent = true;
				}

				var role = ui.customAttr(el, "menuExec");
				if (!!role) {
					addmenuevent(el, "mousedown", role);
					setevent = true;
				}
				role = ui.customAttr(el, "pressExec");
				if (!!role) {
					var roles = role.split(/,/);
					addmenuevent(el, "mousedown", roles[0]);
					if (!!role[1]) {
						addmenuevent(el, "mouseup", roles[1]);
						addmenuevent(el, "mouseleave", roles[1]);
						addmenuevent(el, "touchcancel", roles[1]);
					}
					setevent = true;
				}
				role = ui.customAttr(el, "popup");
				if (!!role) {
					addmenuevent(el, "mousedown", "disppopup");
					setevent = true;
				}

				if (el.className === "link") {
					addmenuevent(el, "mousedown", "updatelink");
					setevent = true; // bypass setting event below
				}

				if (!setevent) {
					if (!menuarea.nohover || !el.querySelector("menu")) {
						addmenuevent(el, "mousedown", function(e) {
							e.preventDefault();
						});
					} else {
						addmenuevent(el, "mousedown", function(e) {
							menuarea.showHovering(e, el);
							e.preventDefault();
							e.stopPropagation();
						});
					}
				}

				var link = ui.customAttr(el, "pidlink");
				if (!!link) {
					el.firstChild.setAttribute("href", link + ui.puzzle.pid);
				}
			} else if (el.nodeType === 1 && el.nodeName === "MENU") {
				var label = el.getAttribute("label");
				if (!!label && label.match(/^__(.+)__(.+)__$/)) {
					menuarea.captions.push({
						menu: el,
						str_jp: RegExp.$1,
						str_en: RegExp.$2
					});
					if (menuarea.nohover) {
						addmenuevent(el, "mousedown", function(e) {
							e.stopPropagation();
						});
					}
				}
			} else if (el.nodeType === 3) {
				if (el.data.match(/^__(.+)__(.+)__$/)) {
					menuarea.captions.push({
						textnode: el,
						str_jp: RegExp.$1,
						str_en: RegExp.$2
					});
				}
			}
		});
	},

	//--------------------------------------------------------------------------------
	// menuarea.modifySelector()  MenuAreaに関するCSSセレクタテキストを変更する (Android向け)
	//--------------------------------------------------------------------------------
	modifySelector: function() {
		/* Android 4.0, iOS5.1以上向け処理です */
		if (!pzpr.env.OS.mobile || !getEL("menupanel").classList) {
			return;
		}
		var sheet = _doc.styleSheets[0];
		var rules = sheet.cssRules || sheet.rules;
		if (rules === null) {
		} // Chromeでローカルファイルを開くとおかしくなるので、とりあえず何もしないようにします

		for (var i = 0, len = rules.length; i < len; i++) {
			var rule = rules[i];
			if (!rule.selectorText) {
				continue;
			}
			if (rule.selectorText.match(/\#menupanel.+\:hover.*/)) {
				sheet.insertRule(rule.cssText.replace(":hover", ".hovering"), i);
				sheet.deleteRule(i + 1);
			}
		}
		this.nohover = true;
	},

	//--------------------------------------------------------------------------------
	// menuarea.showHovering()  MenuAreaのポップアップを表示する (Android向け)
	// menuarea.stopHovering()  MenuAreaのポップアップを消去する (Android向け)
	//--------------------------------------------------------------------------------
	showHovering: function(e, el0) {
		if (!this.nohover) {
			return;
		}
		el0.classList.toggle("hovering");
		ui.misc.walker(getEL("menupanel"), function(el) {
			if (el.nodeType === 1 && !!el.classList && !el.contains(el0)) {
				el.classList.remove("hovering");
			}
		});
	},
	stopHovering: function() {
		if (!this.nohover) {
			return;
		}
		ui.misc.walker(getEL("menupanel"), function(el) {
			if (el.nodeType === 1 && !!el.classList) {
				el.classList.remove("hovering");
			}
		});
	},

	//---------------------------------------------------------------------------
	// menuarea.display()    全てのメニューに対して文字列を設定する
	// menuarea.setdisplay() サブメニューに表示する文字列を個別に設定する
	//---------------------------------------------------------------------------
	display: function() {
		getEL("menupanel").style.display = "";

		getEL("menu_imagesave").className = ui.enableSaveImage ? "" : "disabled";

		var EDITOR = !ui.puzzle.playeronly;
		getEL("menu_edit").style.display = EDITOR ? "" : "none";
		getEL("menu_newboard").style.display = EDITOR ? "" : "none";
		getEL("menu_urloutput").style.display = EDITOR ? "" : "none";
		getEL("menu_adjust").style.display = EDITOR ? "" : "none";
		getEL("menu_turnflip").style.display = EDITOR ? "" : "none";

		for (var idname in this.menuitem) {
			this.setdisplay(idname);
		}
		this.setdisplay("operation");
		this.setdisplay("trialmode");
		this.setdisplay("toolarea");
		this.setdisplay("networkplay");

		/* キャプションの設定 */
		for (var i = 0; i < this.captions.length; i++) {
			var obj = this.captions[i];
			if (!!obj.textnode) {
				obj.textnode.data = ui.selectStr(obj.str_jp, obj.str_en);
			} else if (!!obj.menu) {
				obj.menu.setAttribute("label", ui.selectStr(obj.str_jp, obj.str_en));
			}
		}
	},
	setdisplay: function(idname) {
		if (idname === "trialmode") {
			var trial = ui.puzzle.board.trialstage > 0;
			getEL("menu_adjust").className = trial ? "disabled" : "";
			getEL("menu_turnflip").className = trial ? "disabled" : "";
		}

		if (idname === "toolarea") {
			var str;
			if (!ui.menuconfig.get("toolarea")) {
				str = ui.selectStr("ツールエリアを表示", "Show tool area");
			} else {
				str = ui.selectStr("ツールエリアを隠す", "Hide tool area");
			}
			getEL("menu_toolarea").textContent = str;
		} else if (idname === "networkplay") {
			getEL("menu_network").className = ui.puzzle.opemgr.enableNetwork
				? ""
				: "disabled";
		} else if (this.menuitem === null || !this.menuitem[idname]) {
			/* DO NOTHING */
		} else if (ui.menuconfig.valid(idname)) {
			var menuitem = this.menuitem[idname];
			menuitem.el.style.display = "";

			/* セレクタ部の設定を行う */
			if (!!menuitem.children) {
				var children = menuitem.children;
				var validval =
					idname === "inputmode" ? ui.puzzle.mouse.getInputModeList() : null;
				for (var i = 0; i < children.length; i++) {
					var child = children[i],
						value = ui.customAttr(child, "value"),
						selected = value === "" + ui.menuconfig.get(idname);
					child.className = selected ? "checked" : "";
					child.style.display =
						validval === null || validval.indexOf(value) >= 0 ? "" : "none";
				}
			} else if (!!menuitem.el) {
				/* Check部の表記の変更 */
				var cname = ui.menuconfig.get(idname) ? "checked" : "check";
				var disabled = null;
				if (ui.puzzle.config.getvariant(idname)) {
					disabled = !ui.puzzle.editmode;
				}
				if (disabled === true) {
					cname += " disabled";
				}

				menuitem.el.className = cname;
			}
		} else if (!!this.menuitem[idname]) {
			this.menuitem[idname].el.style.display = "none";
		}
	},

	//---------------------------------------------------------------------------
	// menuarea.checkclick()   メニューから設定値の入力があった時、設定を変更する
	// menuarea.childclick()   メニューから設定値の入力があった時、設定を変更する
	//---------------------------------------------------------------------------
	checkclick: function(e) {
		var el = e.target;
		if (el.nodeName === "SPAN") {
			el = el.parentNode;
		}
		if (el.className.match(/disabled/)) {
			return;
		}

		var idname = ui.customAttr(el, "config");
		ui.menuconfig.set(idname, !ui.menuconfig.get(idname));
	},
	childclick: function(e) {
		var el = e.target;
		if (el.nodeName === "SPAN") {
			el = el.parentNode;
		}

		var parent = el.parentNode.parentNode;
		ui.menuconfig.set(
			ui.customAttr(parent, "config"),
			ui.customAttr(el, "value")
		);
	},

	//---------------------------------------------------------------------------
	// メニューがクリックされた時の動作を呼び出す
	//---------------------------------------------------------------------------
	// submenuから呼び出される関数たち
	undo: function() {
		ui.undotimer.startUndo();
	},
	undostop: function() {
		ui.undotimer.stopUndo();
	},
	undoall: function() {
		ui.puzzle.undoall();
	},
	redo: function() {
		ui.undotimer.startRedo();
	},
	redostop: function() {
		ui.undotimer.stopRedo();
	},
	redoall: function() {
		ui.puzzle.redoall();
	},
	enterTrial: function() {
		if (ui.puzzle.board.trialstage === 0) {
			ui.puzzle.enterTrial();
		}
	},
	enterFurtherTrial: function() {
		ui.puzzle.enterTrial();
	},
	acceptTrial: function() {
		ui.puzzle.acceptTrial();
	},
	rejectTrial: function() {
		ui.puzzle.rejectTrial();
	},
	rejectCurrentTrial: function() {
		ui.puzzle.rejectCurrentTrial();
	},
	toolarea: function() {
		ui.menuconfig.set("toolarea", !ui.menuconfig.get("toolarea"));
		ui.displayAll();
	},
	disppopup: function(e) {
		var el = e.target;
		if (el.nodeName === "SPAN") {
			el = el.parentNode;
		}
		if (el.className !== "disabled") {
			var idname = ui.customAttr(el, "popup");
			if (!pzpr.env.OS.mobile) {
				var pos = pzpr.util.getPagePos(e);
				ui.popupmgr.open(idname, pos.px - 8, pos.py - 8);
			} else {
				var rect = pzpr.util.getRect(getEL("menupanel"));
				ui.popupmgr.open(idname, 8, rect.bottom + 8);
			}
			this.stopHovering();
		}
	},
	updatelink: function(e) {
		var el = e.target;
		var linktype = ui.customAttr(el.parentNode, "linktype");
		switch (linktype) {
			case "duplicate":
				var url = ui.puzzle.getURL(
					pzpr.parser.URL_PZPRFILE,
					ui.puzzle.playeronly ? "player" : "editor"
				);
				el.setAttribute("href", url);
				break;
		}
	},

	//------------------------------------------------------------------------------
	// menuarea.answercheck()「正答判定」ボタンを押したときの処理
	// menuarea.answerclear()  「解答消去」ボタンを押したときの処理
	// menuarea.submarkclear()  「補助消去」ボタンを押したときの処理
	//------------------------------------------------------------------------------
	answercheck: function() {
		var check = ui.puzzle.check(true);
		if (check.complete) {
			ui.timer.stop();
			if (ui.callbackComplete) {
				ui.callbackComplete(ui.puzzle, check);
			}
		}
		var str = "",
			texts = check.text.split(/\n/);
		for (var i = 0; i < texts.length; i++) {
			str += '<div style="margin-bottom:6pt;">' + texts[i] + "</div>";
		}
		this.stopHovering();
		ui.notify.alert(str);
	},
	answerclear: function() {
		this.stopHovering();
		ui.notify.confirm(
			"解答を消去しますか？",
			"Do you want to erase the answer?",
			function() {
				ui.puzzle.ansclear();
			}
		);
	},
	submarkclear: function() {
		this.stopHovering();
		ui.notify.confirm(
			"補助記号を消去しますか？",
			"Do you want to erase the auxiliary marks?",
			function() {
				ui.puzzle.subclear();
			}
		);
	}
};

// Menu.js v3.4.0
/* global _doc:readonly, getEL:readonly */

//---------------------------------------------------------------------------
// ★PopupManagerクラス ポップアップメニューを管理します
//---------------------------------------------------------------------------
ui.popupmgr = {
	popup: null /* 表示中のポップアップメニュー */,

	popups: {} /* 管理しているポップアップメニューのオブジェクト一覧 */,

	movingpop: null /* 移動中のポップアップメニュー */,
	offset: {
		px: 0,
		py: 0
	} /* 移動中ポップアップメニューのページ左上からの位置 */,

	//---------------------------------------------------------------------------
	// popupmgr.reset()      ポップアップメニューの設定をクリアする
	// popupmgr.setEvents()  ポップアップメニュー(タイトルバー)のイベントを設定する
	//---------------------------------------------------------------------------
	reset: function() {
		/* イベントを割り当てる */
		this.setEvents();

		/* Captionを設定する */
		this.translate();
	},

	setEvents: function() {
		ui.event.addEvent(_doc, "mousemove", this, this.titlebarmove);
		ui.event.addEvent(_doc, "mouseup", this, this.titlebarup);
	},

	//---------------------------------------------------------------------------
	// popupmgr.translate()  言語切り替え時にキャプションを変更する
	//---------------------------------------------------------------------------
	translate: function() {
		for (var name in this.popups) {
			this.popups[name].translate();
		}
	},

	//---------------------------------------------------------------------------
	// popupmgr.addpopup()   ポップアップメニューを追加する
	//---------------------------------------------------------------------------
	addpopup: function(idname, proto) {
		var NewPopup = {},
			template = this.popups.template || {};
		for (var name in template) {
			NewPopup[name] = template[name];
		}
		for (name in proto) {
			NewPopup[name] = proto[name];
		}
		this.popups[idname] = NewPopup;
	},

	//---------------------------------------------------------------------------
	// popupmgr.open()  ポップアップメニューを開く
	//---------------------------------------------------------------------------
	open: function(idname, px, py) {
		var target = this.popups[idname] || null;
		if (target !== null) {
			/* 表示しているウィンドウがある場合は閉じる */
			if (!target.multipopup && !!this.popup) {
				this.popup.close();
			}

			/* ポップアップメニューを表示する */
			target.show(px, py);
			return true;
		}
		return false;
	},

	//---------------------------------------------------------------------------
	// popupmgr.titlebardown()  タイトルバーをクリックしたときの動作を行う(タイトルバーにbind)
	// popupmgr.titlebarup()    タイトルバーでボタンを離したときの動作を行う(documentにbind)
	// popupmgr.titlebarmove()  タイトルバーからマウスを動かしたときポップアップメニューを動かす(documentにbind)
	//---------------------------------------------------------------------------
	titlebardown: function(e) {
		var popel = e.target.parentNode;
		var pos = pzpr.util.getPagePos(e);
		this.movingpop = popel;
		this.offset.px = pos.px - parseInt(popel.style.left, 10);
		this.offset.py = pos.py - parseInt(popel.style.top, 10);
		ui.event.enableMouse = false;
		e.preventDefault();
		e.stopPropagation();
	},
	titlebarup: function(e) {
		var popel = this.movingpop;
		if (!!popel) {
			this.movingpop = null;
			ui.event.enableMouse = true;
		}
	},
	titlebarmove: function(e) {
		var popel = this.movingpop;
		if (!!popel) {
			var pos = pzpr.util.getPagePos(e);
			popel.style.left = pos.px - this.offset.px + "px";
			popel.style.top = pos.py - this.offset.py + "px";
			e.preventDefault();
		}
	}
};

//---------------------------------------------------------------------------
// ★PopupMenuクラス ポップアップメニューを作成表示するベースのオブジェクトです
//---------------------------------------------------------------------------
ui.popupmgr.addpopup("template", {
	formname: "",
	multipopup: false,
	pid: "",

	init: function() {
		// 初回1回のみ呼び出される
		this.form = document[this.formname];
		this.pop = this.form.parentNode;
		this.titlebar = this.pop.querySelector(".titlebar") || null;
		if (!!this.titlebar) {
			pzpr.util.unselectable(this.titlebar);
			pzpr.util.addEvent(
				this.titlebar,
				"mousedown",
				ui.popupmgr,
				ui.popupmgr.titlebardown
			);
		}
		pzpr.util.addEvent(this.form, "submit", this, function(e) {
			e.preventDefault();
		});

		this.walkCaption(this.pop);
		this.translate();

		this.walkEvent(this.pop);
	},
	reset: function() {
		// パズルの種類が変わったら呼び出される
	},

	translate: function() {
		if (!this.captions) {
			return;
		}
		for (var i = 0; i < this.captions.length; i++) {
			var obj = this.captions[i];
			var text = ui.selectStr(obj.str_jp, obj.str_en);
			if (!!obj.textnode) {
				obj.textnode.data = text;
			} else if (!!obj.button) {
				obj.button.value = text;
			}
		}
	},

	walkCaption: function(parent) {
		var popup = this;
		this.captions = [];
		ui.misc.walker(parent, function(el) {
			if (el.nodeType === 3 && el.data.match(/^__(.+)__(.+)__$/)) {
				popup.captions.push({
					textnode: el,
					str_jp: RegExp.$1,
					str_en: RegExp.$2
				});
			}
		});
	},
	walkEvent: function(parent) {
		var popup = this;
		function eventfactory(role) {
			return function(e) {
				popup[role](e);
				if (e.type !== "click") {
					e.preventDefault();
					e.stopPropagation();
				}
			};
		}
		ui.misc.walker(parent, function(el) {
			if (el.nodeType !== 1) {
				return;
			}
			var role = ui.customAttr(el, "buttonExec");
			if (!!role) {
				pzpr.util.addEvent(
					el,
					!pzpr.env.API.touchevent ? "click" : "mousedown",
					popup,
					eventfactory(role)
				);
			}
			role = ui.customAttr(el, "changeExec");
			if (!!role) {
				pzpr.util.addEvent(el, "change", popup, eventfactory(role));
			}
		});
	},

	show: function(px, py) {
		// 表示するたびに呼び出される
		if (!this.pop) {
			this.init();
		}
		if (this.pid !== ui.puzzle.pid) {
			this.pid = ui.puzzle.pid;
			this.reset();
		}

		this.pop.style.left = px + "px";
		this.pop.style.top = py + "px";
		this.pop.style.display = "inline";
		if (!this.multipopup) {
			ui.popupmgr.popup = this;
		}
	},
	close: function() {
		this.pop.style.display = "none";
		if (!this.multipopup) {
			ui.popupmgr.popup = null;
		}

		ui.puzzle.key.enableKey = true;
		ui.puzzle.mouse.enableMouse = true;
	}
});

//---------------------------------------------------------------------------
// ★Popup_NewBoardクラス 新規盤面作成のポップアップメニューを作成したり表示します
//---------------------------------------------------------------------------
ui.popupmgr.addpopup("newboard", {
	formname: "newboard",

	reset: function() {
		ui.misc.displayByPid(this.pop);
		if (this.pid !== "tawa") {
			return;
		}
		for (var i = 0; i <= 3; i++) {
			var _div = getEL("nb_shape_" + i),
				_img = _div.children[0];
			_img.src =
				"data:image/gif;base64,R0lGODdhgAAgAKEBAAAAAP//AP//////ACwAAAAAgAAgAAAC/pSPqcvtD6OctNqLs968+98A4kiWJvmcquisrtm+MpAAwY0Hdn7vPN1aAGstXs+oQw6FyqZxKfDlpDhqLyXMhpw/ZfHJndbCVW9QATWkEdYk+Pntvn/j+dQc0hK39jKcLxcoxkZ29JeHpsfUZ0gHeMeoUyfo54i4h7lI2TjI0PaJp1boZumpeLCGOvoZB7kpyTbzIiTrglY7o4Yrc8l2irYamjiciar2G4VM7Lus6fpcdVZ8PLxmrTyd3AwcydprvK19HZ6aPf5YCX31TW3ezuwOcQ7vGXyIPA+e/w6ORZ5ir9S/gfu0ZRt4UFU3YfHiFSyoaxeMWxJLUKx4IiLGZIn96HX8iNBjQ5EG8Zkk+dDfyJAgS7Lkxy9lOJTYXMK0ibOlTJ0n2eEs97OnUJ40X668SfRo0ZU7SS51erOp0XxSkSaFGtTo1a0bUcSo9bVr2I0gypo9izat2rVs27p9Czfu2QIAOw==";
			_img.style.clip =
				"rect(0px," + (i + 1) * 32 + "px," + 32 + "px," + i * 32 + "px)";
		}
	},
	show: function(px, py) {
		ui.popupmgr.popups.template.show.call(this, px, py);
		ui.puzzle.key.enableKey = false;

		switch (ui.puzzle.pid) {
			case "sudoku":
				this.setsize_sudoku();
				break;
			case "tawa":
				this.setsize_tawa();
				break;
			default:
				this.setsize();
				break;
		}
	},

	//---------------------------------------------------------------------------
	// setsize()   盤面のサイズをセットする
	// getsize()   盤面のサイズを取得する
	//---------------------------------------------------------------------------
	setsize: function() {
		var bd = ui.puzzle.board;
		this.form.col.value = "" + bd.cols;
		this.form.row.value = "" + bd.rows;
	},
	getsize: function() {
		var col = this.form.col.value | 0;
		var row = this.form.row.value | 0;
		return !!col && !!row ? { col: col, row: row } : null;
	},

	//---------------------------------------------------------------------------
	// setsize_sudoku()   盤面のサイズをセットする (数独向け)
	// getsize_sudoku()   盤面のサイズを取得する (数独向け)
	//---------------------------------------------------------------------------
	setsize_sudoku: function() {
		for (var i = 0; i < 4; i++) {
			getEL("nb_size_sudoku_" + i).checked = "";
		}
		switch (ui.puzzle.board.cols) {
			case 16:
				getEL("nb_size_sudoku_2").checked = true;
				break;
			case 25:
				getEL("nb_size_sudoku_3").checked = true;
				break;
			case 4:
				getEL("nb_size_sudoku_0").checked = true;
				break;
			case 6:
				getEL("nb_size_sudoku_4").checked = true;
				break;
			default:
				getEL("nb_size_sudoku_1").checked = true;
				break;
		}
	},
	getsize_sudoku: function() {
		var col, row;
		if (getEL("nb_size_sudoku_2").checked) {
			col = row = 16;
		} else if (getEL("nb_size_sudoku_3").checked) {
			col = row = 25;
		} else if (getEL("nb_size_sudoku_0").checked) {
			col = row = 4;
		} else if (getEL("nb_size_sudoku_4").checked) {
			col = row = 6;
		} else {
			col = row = 9;
		}
		return { col: col, row: row };
	},

	//---------------------------------------------------------------------------
	// setsize_tawa()   盤面のサイズをセットする (たわむれんが向け)
	// getsize_tawa()   盤面のサイズを取得する (たわむれんが向け)
	//---------------------------------------------------------------------------
	setsize_tawa: function() {
		/* タテヨコのサイズ指定部分 */
		var bd = ui.puzzle.board,
			col = bd.cols,
			row = bd.rows,
			shape = bd.shape;

		if (shape === 3) {
			col++;
		}
		this.form.col.value = "" + col;
		this.form.row.value = "" + row;

		/* たわむレンガの形状指定ルーチン */
		this.setshape(shape);
	},
	getsize_tawa: function() {
		var col = this.form.col.value | 0;
		var row = this.form.row.value | 0;
		if (!col || !row) {
			return null;
		}

		var shape = this.getshape();
		if (!isNaN(shape) && !(col === 1 && (shape === 0 || shape === 3))) {
			if (shape === 3) {
				col--;
			}
		} else {
			return null;
		}

		return { col: col, row: row, shape: shape };
	},

	//---------------------------------------------------------------------------
	// setshape()   たわむれんの形状から形状指定ボタンの初期値をセットする
	// getshape()   たわむれんがのどの形状が指定されか取得する
	// clickshape() たわむれんがの形状指定ボタンを押した時の処理を行う
	// setshapeidx() たわむれんがの形状指定ボタンに背景色を設定する
	// getshapeidx() たわむれんがの形状指定ボタン背景色からインデックスを取得する
	//---------------------------------------------------------------------------
	setshape: function(shape) {
		this.setshapeidx([0, 2, 3, 1][shape]);
	},
	getshape: function() {
		var idx = this.getshapeidx();
		return idx !== null ? [0, 3, 1, 2][idx] : null;
	},
	clickshape: function(e) {
		this.setshapeidx(+e.target.parentNode.id.charAt(9));
	},

	setshapeidx: function(idx) {
		for (var i = 0; i <= 3; i++) {
			getEL("nb_shape_" + i).style.backgroundColor = i === idx ? "red" : "";
		}
	},
	getshapeidx: function() {
		for (var i = 0; i <= 3; i++) {
			if (getEL("nb_shape_" + i).style.backgroundColor === "red") {
				return i;
			}
		}
		return null;
	},

	//---------------------------------------------------------------------------
	// execute() 新規盤面を作成するボタンを押したときの処理を行う
	//---------------------------------------------------------------------------
	execute: function() {
		var pid = ui.puzzle.pid;
		var obj;
		switch (pid) {
			case "sudoku":
				obj = this.getsize_sudoku();
				break;
			case "tawa":
				obj = this.getsize_tawa();
				break;
			default:
				obj = this.getsize();
				break;
		}

		this.close();
		if (!!obj) {
			var url = pid + "/" + obj.col + "/" + obj.row;
			if (pid === "tawa") {
				url += "/" + obj.shape;
			}
			ui.puzzle.open(url);
		}
	}
});

//---------------------------------------------------------------------------
// ★Popup_URLInputクラス URL入力のポップアップメニューを作成したり表示します
//---------------------------------------------------------------------------
ui.popupmgr.addpopup("urlinput", {
	formname: "urlinput",

	//------------------------------------------------------------------------------
	// urlinput() URLを入力する
	//------------------------------------------------------------------------------
	urlinput: function() {
		this.close();
		ui.puzzle.open(this.form.ta.value.replace(/\n/g, ""));
	}
});

//---------------------------------------------------------------------------
// ★Popup_URLOutputクラス URL出力のポップアップメニューを作成したり表示します
//---------------------------------------------------------------------------
ui.popupmgr.addpopup("urloutput", {
	formname: "urloutput",

	init: function() {
		ui.popupmgr.popups.template.init.call(this);
		this.urlanchor = getEL("urlanchor");
	},

	reset: function(px, py) {
		var form = this.form,
			pid = ui.puzzle.pid,
			exists = pzpr.variety(pid).exists,
			parser = pzpr.parser;
		var url = ui.puzzle.getURL(parser.URL_PZPRV3);
		this.urlanchor.href = this.urlanchor.textContent = url;
		form.kanpen.style.display = form.kanpen.nextSibling.style.display = exists.kanpen
			? ""
			: "none";
		form.heyaapp.style.display = form.heyaapp.nextSibling.style.display =
			pid === "heyawake" ? "" : "none";
	},

	show: function(px, py) {
		ui.popupmgr.popups.template.show.call(this, px, py);
		this.reset(px, py);
	},

	//------------------------------------------------------------------------------
	// urloutput() URLを出力する
	// openurl()   「このURLを開く」を実行する
	//------------------------------------------------------------------------------
	urloutput: function(e) {
		var url = "",
			parser = pzpr.parser;
		switch (e.target.name) {
			case "kanpen":
				url = ui.puzzle.getURL(parser.URL_KANPEN);
				break;
			case "pzprv3e":
				url = ui.puzzle
					.getURL(parser.URL_PZPRV3)
					.replace(/\?(\w+)/, "?$1_edit");
				break;
			case "heyaapp":
				url = ui.puzzle.getURL(parser.URL_HEYAAPP);
				break;
		}
		this.urlanchor.href = this.urlanchor.textContent = url;
	}
});

//---------------------------------------------------------------------------
// ★Popup_FileOpenクラス ファイル入力のポップアップメニューを作成したり表示します
//---------------------------------------------------------------------------
ui.popupmgr.addpopup("fileopen", {
	formname: "fileform",

	init: function() {
		ui.popupmgr.popups.template.init.call(this);
	},

	//------------------------------------------------------------------------------
	// fileopen()  ファイルを開く
	//------------------------------------------------------------------------------
	fileopen: function(e) {
		var fileEL = this.form.filebox;
		if (!!ui.reader || ui.enableGetText) {
			var fitem = fileEL.files[0];
			if (!fitem) {
				return;
			}

			if (!!ui.reader) {
				ui.reader.readAsText(fitem);
			} else {
				ui.puzzle.open(fitem.getAsText(""));
			}
		}
		this.form.reset();
		this.close();
	}
});

//---------------------------------------------------------------------------
// ★Popup_FileSaveクラス ファイル出力のポップアップメニューを作成したり表示します
//---------------------------------------------------------------------------
ui.popupmgr.addpopup("filesave", {
	formname: "filesave",
	anchor: null,
	init: function() {
		ui.popupmgr.popups.template.init.call(this);

		this.anchor =
			!ui.enableSaveBlob && pzpr.env.API.anchor_download
				? getEL("saveanchor")
				: null;
	},
	reset: function() {
		/* ファイル形式選択オプション */
		var ispencilbox = pzpr.variety(ui.puzzle.pid).exists.pencilbox;
		this.form.filetype.options[1].disabled = !ispencilbox;
		this.form.filetype.options[2].disabled = !ispencilbox;
		var parser = pzpr.parser;
		this.form.ta.value = ui.puzzle.getFileData(parser.FILE_PZPR, {});
		this.form.ta2.value = this.form.ta.value.replace(/\n/g, "/");
	},
	/* オーバーライド */
	show: function(px, py) {
		ui.popupmgr.popups.template.show.call(this, px, py);
		this.reset();

		this.form.filename.value = ui.puzzle.pid + ".txt";
		this.changefilename();

		ui.puzzle.key.enableKey = false;
	},
	close: function() {
		if (!!this.filesaveurl) {
			URL.revokeObjectURL(this.filesaveurl);
		}

		ui.popupmgr.popups.template.close.call(this);
	},
	changefilename: function() {
		var filetype = this.form.filetype.value;
		var filename = this.form.filename.value
			.replace(".xml", "")
			.replace(".txt", "");
		var ext = filetype !== "filesave4" ? ".txt" : ".xml";
		var pinfo = pzpr.variety(filename);
		if (pinfo.pid === ui.puzzle.pid) {
			if (filetype === "filesave" || filetype === "filesave3") {
				filename = pinfo.urlid;
			} else {
				filename = pinfo.kanpenid;
			}
		}
		this.form.filename.value = filename + ext;
	},

	//------------------------------------------------------------------------------
	// filesave()  ファイルを保存する
	//------------------------------------------------------------------------------
	filesaveurl: null,
	filesave: function() {
		var form = this.form;
		var filename = form.filename.value;
		var prohibit = ["\\", "/", ":", "*", "?", '"', "<", ">", "|"];
		for (var i = 0; i < prohibit.length; i++) {
			if (filename.indexOf(prohibit[i]) !== -1) {
				ui.notify.alert("ファイル名として使用できない文字が含まれています。");
				return;
			}
		}

		var parser = pzpr.parser,
			filetype = parser.FILE_PZPR,
			option = {};
		switch (form.filetype.value) {
			case "filesave2":
				filetype = parser.FILE_PBOX;
				break;
			case "filesave4":
				filetype = parser.FILE_PBOX_XML;
				break;
			case "filesave3":
				filetype = parser.FILE_PZPR;
				option.history = true;
				break;
		}

		var blob = null,
			filedata = null;
		if (ui.enableSaveBlob || !!this.anchor) {
			blob = new Blob([ui.puzzle.getFileData(filetype, option)], {
				type: "text/plain"
			});
		} else {
			filedata = ui.puzzle.getFileData(filetype, option);
		}

		if (ui.enableSaveBlob) {
			navigator.saveBlob(blob, filename);
			this.close();
		} else if (!!this.anchor) {
			if (!!this.filesaveurl) {
				URL.revokeObjectURL(this.filesaveurl);
			}
			this.filesaveurl = URL.createObjectURL(blob);
			this.anchor.href = this.filesaveurl;
			this.anchor.download = filename;
			this.anchor.click();
		} else {
			form.ques.value = filedata;
			form.operation.value =
				form.filetype.value !== "filesave4" ? "save" : "savexml";
			form.submit();
			this.close();
		}

		ui.puzzle.saved();
	}
});

//---------------------------------------------------------------------------
// ★Popup_ImageSaveクラス 画像出力のポップアップメニューを作成したり表示します
//---------------------------------------------------------------------------
ui.popupmgr.addpopup("imagesave", {
	formname: "imagesave",
	anchor: null,
	showsize: null,
	init: function() {
		ui.popupmgr.popups.template.init.call(this);

		this.anchor =
			!ui.enableSaveBlob && pzpr.env.API.anchor_download
				? getEL("saveanchor")
				: null;
		this.showsize = getEL("showsize");

		/* ファイル形式選択オプション */
		var filetype = this.form.filetype,
			options = filetype.options;
		for (var i = 0; i < options.length; i++) {
			var option = options[i];
			if (!ui.enableImageType[option.value]) {
				filetype.removeChild(option);
				i--;
			}
		}
	},

	/* オーバーライド */
	show: function(px, py) {
		ui.popupmgr.popups.template.show.call(this, px, py);

		ui.puzzle.key.enableKey = false;
		ui.puzzle.mouse.enableMouse = false;

		this.form.filename.value = pzpr.variety(ui.puzzle.pid).urlid + ".png";
		this.form.cellsize.value = ui.menuconfig.get("cellsizeval");

		this.changefilename();
		this.estimatesize();
	},
	close: function() {
		if (!!this.saveimageurl) {
			URL.revokeObjectURL(this.saveimageurl);
		}

		ui.puzzle.setCanvasSize();
		ui.popupmgr.popups.template.close.call(this);
	},

	changefilename: function() {
		var filename = this.form.filename.value.replace(/\.\w{3,4}$/, ".");
		this.form.filename.value = filename + this.form.filetype.value;
	},
	estimatesize: function() {
		var cellsize = +this.form.cellsize.value;
		var width = (+cellsize * ui.puzzle.painter.getCanvasCols()) | 0;
		var height = (+cellsize * ui.puzzle.painter.getCanvasRows()) | 0;
		this.showsize.replaceChild(
			_doc.createTextNode(width + " x " + height),
			this.showsize.firstChild
		);
	},

	//------------------------------------------------------------------------------
	// saveimage()    画像をダウンロードする
	// submitimage() "画像をダウンロード"の処理ルーチン
	// saveimage()   "画像をダウンロード"の処理ルーチン (IE10用)
	//------------------------------------------------------------------------------
	saveimageurl: null,
	saveimage: function() {
		/* ファイル名チェックルーチン */
		var form = this.form;
		var filename = form.filename.value;
		var prohibit = ["\\", "/", ":", "*", "?", '"', "<", ">", "|"];
		for (var i = 0; i < prohibit.length; i++) {
			if (filename.indexOf(prohibit[i]) !== -1) {
				ui.notify.alert("ファイル名として使用できない文字が含まれています。");
				return;
			}
		}

		/* 画像出力ルーチン */
		var option = { cellsize: +this.form.cellsize.value };
		if (this.form.transparent.checked) {
			option.bgcolor = "";
		}
		var type = form.filetype.value;

		try {
			if (ui.enableSaveBlob || !!this.anchor) {
				ui.puzzle.toBlob(
					function(blob) {
						/* 出力された画像の保存ルーチン */
						if (ui.enableSaveBlob) {
							navigator.saveBlob(blob, filename);
							this.close();
						} else {
							if (!!this.filesaveurl) {
								URL.revokeObjectURL(this.filesaveurl);
							}
							this.filesaveurl = URL.createObjectURL(blob);
							this.anchor.href = this.filesaveurl;
							this.anchor.download = filename;
							this.anchor.click();
							this.close();
						}
					}.bind(this),
					type,
					1.0,
					option
				);
			} else {
				/* 出力された画像の保存ルーチン */
				form.urlstr.value = ui.puzzle
					.toDataURL(type, 1.0, option)
					.replace(/data:.*;base64,/, "");
				form.submit();
				this.close();
			}
		} catch (e) {
			ui.notify.alert("画像の出力に失敗しました", "Fail to Output the Image");
		}
	},

	//------------------------------------------------------------------------------
	// openimage()   "別ウィンドウで開く"の処理ルーチン
	//------------------------------------------------------------------------------
	openimage: function() {
		/* 画像出力ルーチン */
		var option = { cellsize: +this.form.cellsize.value };
		if (this.form.transparent.checked) {
			option.bgcolor = "";
		}
		var type = this.form.filetype.value;
		var IEkei = navigator.userAgent.match(/(Trident|Edge)\//);

		var dataurl = "";
		try {
			if (!IEkei || type !== "svg") {
				dataurl = ui.puzzle.toDataURL(type, 1.0, option);
			} else {
				dataurl = ui.puzzle.toBuffer("svg", option);
			}
		} catch (e) {
			ui.notify.alert("画像の出力に失敗しました", "Fail to Output the Image");
		}
		if (!dataurl) {
			/* No Data URL */ return;
		}

		/* 出力された画像を開くルーチン */
		function writeContent(blob) {
			var filename = this.form.filename.value;
			var cdoc = window.open("", "", "").document;
			cdoc.open();
			cdoc.writeln('<!DOCTYPE html>\n<HTML LANG="ja">\n<HEAD>');
			cdoc.writeln('<META CHARSET="utf-8">');
			cdoc.writeln("<TITLE>ぱずぷれv3</TITLE>\n</HEAD><BODY>");
			if (!!blob) {
				cdoc.writeln('<img src="', dataurl, '"><br>\n');
				cdoc.writeln(
					'<a href="',
					cdoc.defaultView.URL.createObjectURL(blob),
					'" download="',
					filename,
					'">Download ',
					filename,
					"</a>"
				);
			} else if (!IEkei || type !== "svg") {
				cdoc.writeln('<img src="', dataurl, '">');
			} else {
				cdoc.writeln(dataurl.replace(/^<\?.+?\?>/, ""));
			}
			cdoc.writeln("</BODY>\n</HTML>");
			cdoc.close();
		}
		if (pzpr.env.API.anchor_download) {
			// ChromeでDataURLが直接開けない対策
			ui.puzzle.toBlob(writeContent.bind(this), type, 1.0, option);
		} else {
			writeContent(null);
		}
	}
});

//---------------------------------------------------------------------------
// ★Popup_Adjustクラス 盤面の調整のポップアップメニューを作成したり表示します
//---------------------------------------------------------------------------
ui.popupmgr.addpopup("adjust", {
	formname: "adjust",

	adjust: function(e) {
		ui.puzzle.board.operate(e.target.name);
	}
});

//---------------------------------------------------------------------------
// ★Popup_TurnFlipクラス 回転・反転のポップアップメニューを作成したり表示します
//---------------------------------------------------------------------------
ui.popupmgr.addpopup("turnflip", {
	formname: "turnflip",

	reset: function() {
		this.form.turnl.disabled = ui.puzzle.pid === "tawa";
		this.form.turnr.disabled = ui.puzzle.pid === "tawa";
	},

	adjust: function(e) {
		ui.puzzle.board.operate(e.target.name);
	}
});

//---------------------------------------------------------------------------
// ★Popup_Metadataクラス メタデータの設定・表示を行うメニューを作成したり表示します
//---------------------------------------------------------------------------
ui.popupmgr.addpopup("metadata", {
	formname: "metadata",

	show: function(px, py) {
		ui.popupmgr.popups.template.show.call(this, px, py);

		var form = this.form;
		var puzzle = ui.puzzle,
			bd = puzzle.board,
			meta = puzzle.metadata;
		getEL("metadata_variety").innerHTML =
			pzpr.variety(puzzle.pid)[pzpr.lang] + "&nbsp;" + bd.cols + "×" + bd.rows;
		form.author.value = meta.author;
		form.source.value = meta.source;
		form.hard.value = meta.hard;
		form.comment.value = meta.comment;
	},

	save: function() {
		var form = this.form;
		var puzzle = ui.puzzle,
			meta = puzzle.metadata;
		meta.author = form.author.value;
		meta.source = form.source.value;
		meta.hard = form.hard.value;
		meta.comment = form.comment.value;
		this.close();
	}
});

//---------------------------------------------------------------------------
// ★Popup_DispSizeクラス サイズの変更を行うポップアップメニューを作成したり表示します
//---------------------------------------------------------------------------
ui.popupmgr.addpopup("dispsize", {
	formname: "dispsize",

	show: function(px, py) {
		ui.popupmgr.popups.template.show.call(this, px, py);

		this.form.cellsize.value = ui.menuconfig.get("cellsizeval");
		ui.puzzle.key.enableKey = false;
	},

	//------------------------------------------------------------------------------
	// changesize()  Canvasでのマス目の表示サイズを変更する
	//------------------------------------------------------------------------------
	changesize: function(e) {
		var csize = this.form.cellsize.value | 0;
		if (csize > 0) {
			ui.menuconfig.set("cellsizeval", csize);
		}
		this.close();
	}
});

//---------------------------------------------------------------------------
// ★Popup_About
//---------------------------------------------------------------------------
ui.popupmgr.addpopup("about", {
	formname: "about"
});

ui.popupmgr.addpopup("network", {
	formname: "network", // just to fit in with how popup template works
	urlanchor: null,
	key: "",

	init: function() {
		ui.popupmgr.popups.template.init.call(this);
		this.urlanchor = getEL("urlanchor_network");
		this.key = Math.random()
			.toString(36)
			.substr(2, 8);
	},

	coop: function(px, py) {
		var parser = pzpr.parser;
		var url = ui.puzzle.getURL(parser.URL_PZPRV3);
		url = url.replace("?", "?net=coop&key=" + this.key + "&");
		this.urlanchor.href = this.urlanchor.textContent = url;
		ui.network.configure("coop", this.key);
		ui.network.start();
	}
});

// ToolArea.js v3.4.0
/* global getEL:readonly */

// メニュー描画/取得/html表示系
// toolareaオブジェクト
ui.toolarea = {
	items: null, // ツールパネルのエレメント等を保持する
	captions: [], // 言語指定を切り替えた際のキャプションを保持する

	//---------------------------------------------------------------------------
	// toolarea.reset()  ツールパネル・ボタン領域の初期設定を行う
	//---------------------------------------------------------------------------
	reset: function() {
		if (this.items === null) {
			this.items = {};
			this.walkElement(getEL("usepanel"));
			this.walkElement(getEL("checkpanel"));
			this.walkElement(getEL("variantpanel"));
			this.walkElement(getEL("btnarea"));
		}
		ui.misc.displayByPid(getEL("checkpanel"));
		ui.misc.displayByPid(getEL("btnarea"));

		this.display();
	},

	//---------------------------------------------------------------------------
	// toolarea.walkElement()  エレメントを探索して領域の初期設定を行う
	//---------------------------------------------------------------------------
	walkElement: function(parent) {
		var toolarea = this;
		function btnfactory(role) {
			return function(e) {
				toolarea[role](e);
				if (e.type !== "click") {
					e.stopPropagation();
				}
			};
		}
		function addbtnevent(el, type, role) {
			pzpr.util.addEvent(el, type, toolarea, btnfactory(role));
		}
		ui.misc.walker(parent, function(el) {
			if (el.nodeType === 1) {
				/* ツールパネル領域 */
				var parent, idname;
				if (el.className === "config") {
					toolarea.items[ui.customAttr(el, "config")] = { el: el };
				} else if (el.className.match(/child/)) {
					(parent = el.parentNode.parentNode),
						(idname = ui.customAttr(parent, "config"));
					var item = toolarea.items[idname];
					if (!item.children) {
						item.children = [];
					}
					item.children.push(el);

					addbtnevent(el, "mousedown", "toolclick");
				} else if (el.nodeName === "INPUT" && el.type === "checkbox") {
					(parent = el.parentNode), (idname = ui.customAttr(parent, "config"));
					if (!idname) {
						(parent = parent.parentNode),
							(idname = ui.customAttr(parent, "config"));
					}
					if (!idname) {
						return;
					}
					toolarea.items[idname].checkbox = el;

					addbtnevent(el, "click", "toolclick");
				}

				/* ボタン領域 */
				var role = ui.customAttr(el, "buttonExec");
				if (!!role) {
					addbtnevent(
						el,
						!pzpr.env.API.touchevent ? "click" : "mousedown",
						role
					);
				}
				role = ui.customAttr(el, "pressExec");
				if (!!role) {
					var roles = role.split(/,/);
					addbtnevent(el, "mousedown", roles[0]);
					if (!!role[1]) {
						addbtnevent(el, "mouseup", roles[1]);
						addbtnevent(el, "mouseleave", roles[1]);
						addbtnevent(el, "touchcancel", roles[1]);
					}
				}
			} else if (el.nodeType === 3) {
				if (el.data.match(/^__(.+)__(.+)__$/)) {
					var str_jp = RegExp.$1,
						str_en = RegExp.$2;
					toolarea.captions.push({
						textnode: el,
						str_jp: str_jp,
						str_en: str_en
					});
					parent = el.parentNode;
					if (parent.className.match(/child/)) {
						toolarea.captions.push({
							datanode: parent,
							str_jp: str_jp,
							str_en: str_en
						});
					}
				}
			}
		});
	},

	//---------------------------------------------------------------------------
	// toolarea.display()    全てのラベルに対して文字列を設定する
	// toolarea.displayVariantPanel() display the variant panel
	// toolarea.setdisplay() 管理パネルに表示する文字列を個別に設定する
	//---------------------------------------------------------------------------
	display: function() {
		/* ツールパネル領域 */
		/* -------------- */
		var mandisp = ui.menuconfig.get("toolarea") ? "block" : "none";
		getEL("usepanel").style.display = mandisp;
		getEL("checkpanel").style.display = mandisp;

		/* 経過時間の表示/非表示設定 */
		getEL("separator2").style.display =
			ui.puzzle.playeronly && ui.menuconfig.get("toolarea") ? "" : "none";
		getEL("timerpanel").style.display = ui.puzzle.playeronly ? "block" : "none";
		this.displayVariantPanel();

		for (var idname in this.items) {
			this.setdisplay(idname);
		}

		/* ボタン領域 */
		/* --------- */
		getEL("btnarea").style.display = "";
		pzpr.util.unselectable(getEL("btnarea"));

		this.setdisplay("operation");
		getEL("btnclear2").style.display = !ui.puzzle.board.disable_subclear
			? ""
			: "none";
		getEL("btncolor").style.display =
			ui.puzzle.pid === "tentaisho" ? "" : "none";
		getEL("btnflush").style.display =
			ui.puzzle.board.hasflush && !ui.puzzle.playeronly ? "" : "none";
		/* ボタンエリアの色分けボタンは、ツールパネル領域が消えている時に表示 */
		getEL("btnirowake").style.display =
			ui.puzzle.painter.irowake && !ui.menuconfig.get("toolarea") ? "" : "none";
		getEL("btnirowakeblk").style.display =
			ui.puzzle.painter.irowakeblk && !ui.menuconfig.get("toolarea")
				? ""
				: "none";
		this.setdisplay("trialmode");
		this.setdisplay("network");

		/* 共通：キャプションの設定 */
		/* --------------------- */
		for (var i = 0; i < this.captions.length; i++) {
			var obj = this.captions[i];
			if (!!obj.textnode) {
				obj.textnode.data = ui.selectStr(obj.str_jp, obj.str_en);
			}
			if (!!obj.datanode) {
				obj.datanode.setAttribute(
					"data-text",
					ui.selectStr(obj.str_jp, obj.str_en)
				);
			}
		}
	},
	displayVariantPanel: function() {
		// display if the type has variants, and we're in edit mode or some
		// variants are enabled
		var shouldDisplay = (function() {
			if (!ui.menuconfig.get("toolarea")) {
				return false;
			}
			var variants = ui.puzzle.config.getVariants();
			if (Object.keys(variants).length <= 0) {
				return false;
			}
			if (!ui.puzzle.playmode) {
				return true;
			}
			for (var key in variants) {
				if (variants[key]) {
					return true;
				}
			}
		})();
		var vardisp = shouldDisplay ? "block" : "none";
		getEL("separator1").style.display = vardisp;
		getEL("variantpanel").style.display = vardisp;
	},
	setdisplay: function(idname) {
		if (idname === "variant") {
			var str;
			if (ui.menuconfig.get("variant")) {
				str = ui.selectStr("本家ルールでチェック", "Check base type");
			} else {
				str = ui.selectStr("チェック", "Check");
			}
			getEL("btncheck").textContent = str;
		}

		var trial = ui.puzzle.board.trialstage > 0;
		var net = ui.network.mode !== "";

		if (idname === "operation") {
			var opemgr = ui.puzzle.opemgr;
			getEL("btnundo").disabled = !opemgr.enableUndo;
			getEL("btnredo").disabled = !opemgr.enableRedo;
			getEL("btntriale").disabled = opemgr.atStartOfTrial();
		} else if (idname === "trialmode") {
			getEL("btnclear").disabled = trial;
			getEL("btntrial").disabled = trial;
			getEL("btntrialarea").style.display = trial && !net ? "block" : "none";
		} else if (idname === "network") {
			getEL("btnundo").style.display = net ? "none" : "inline";
			getEL("btnredo").style.display = net ? "none" : "inline";
			getEL("btntrial").style.display = net ? "none" : "inline";
			getEL("btntrialarea").style.display = trial && !net ? "block" : "none";
		} else if (this.items === null || !this.items[idname]) {
			/* DO NOTHING */
		} else if (ui.menuconfig.valid(idname)) {
			var toolitem = this.items[idname];
			toolitem.el.style.display = "";

			if (idname === "mode") {
				this.displayVariantPanel();
			}

			var disabled = null;
			/* 子要素の設定を行う */
			if (!!toolitem.children) {
				var children = toolitem.children;
				var validval =
					idname === "inputmode" ? ui.puzzle.mouse.getInputModeList() : null;
				for (var i = 0; i < children.length; i++) {
					var child = children[i],
						value = ui.customAttr(child, "value"),
						selected = value === "" + ui.menuconfig.get(idname);
					child.className = selected ? "child childsel" : "child";
					child.style.display =
						validval === null || validval.indexOf(value) >= 0 ? "" : "none";
				}

				if (idname === "inputmode") {
					disabled = validval.length === 1;
				}
				if (disabled !== null) {
					toolitem.el.className = !disabled ? "" : "disabled";
				}
			} else if (!!toolitem.checkbox) {
				/* チェックボックスの表記の設定 */
				var check = toolitem.checkbox;
				if (!!check) {
					check.checked = ui.menuconfig.get(idname);
				}

				if (idname === "keypopup") {
					disabled = !ui.keypopup.paneltype[ui.puzzle.editmode ? 1 : 3];
				}
				if (idname === "bgcolor") {
					disabled = ui.puzzle.editmode;
				}
				if (ui.puzzle.config.getvariant(idname)) {
					disabled = !ui.puzzle.editmode;
				}
				if (disabled !== null) {
					toolitem.checkbox.disabled = !disabled ? "" : "true";
				}
			}
		} else if (!!this.items[idname]) {
			this.items[idname].el.style.display = "none";
		}
	},

	//---------------------------------------------------------------------------
	// toolarea.toolclick()   ツールパネルの入力があった時、設定を変更する
	//---------------------------------------------------------------------------
	toolclick: function(e) {
		var el = e.target,
			parent = el.parentNode;
		var idname =
				ui.customAttr(parent, "config") ||
				ui.customAttr(parent.parentNode, "config"),
			value;
		if (!!this.items[idname].checkbox) {
			value = !!el.checked;
		} else {
			value = ui.customAttr(el, "value");
		}
		ui.menuconfig.set(idname, value);
	},

	//---------------------------------------------------------------------------
	// Canvas下にあるボタンが押された/放された時の動作
	//---------------------------------------------------------------------------
	answercheck: function() {
		ui.menuarea.answercheck();
	},
	undo: function() {
		ui.undotimer.startUndo();
	},
	undostop: function() {
		ui.undotimer.stopUndo();
	},
	redo: function() {
		ui.undotimer.startRedo();
	},
	redostop: function() {
		ui.undotimer.stopRedo();
	},
	ansclear: function() {
		ui.menuarea.answerclear();
	},
	subclear: function() {
		ui.menuarea.submarkclear();
	},
	irowake: function() {
		ui.puzzle.irowake();
	},
	encolorall: function() {
		ui.puzzle.board.encolorall();
	} /* 天体ショーのボタン */,
	dropblocks: function() {
		ui.puzzle.board.operate("drop");
	},
	resetblocks: function() {
		ui.puzzle.board.operate("resetpos");
	},
	flushexcell: function() {
		ui.puzzle.board.flushexcell();
	},
	enterTrial: function() {
		if (ui.puzzle.board.trialstage === 0) {
			ui.puzzle.enterTrial();
		}
	},
	enterFurtherTrial: function() {
		ui.puzzle.enterTrial();
	},
	acceptTrial: function() {
		ui.puzzle.acceptTrial();
	},
	rejectTrial: function() {
		ui.puzzle.rejectCurrentTrial();
	}
};

// Notify.js v3.5.0
/* global getEL:readonly */

//---------------------------------------------------------------------------
// ★Notifyクラス alert, confirm関連を管理します
//---------------------------------------------------------------------------
ui.notify = {
	onconfirm: null,

	//---------------------------------------------------------------------------
	// notify.reset()      Notificationの設定を初期化する
	//---------------------------------------------------------------------------
	reset: function() {
		/* イベントを割り当てる */
		this.walkElement(getEL("notifies"));
	},

	//---------------------------------------------------------------------------
	// notify.walkElement()  エレメントを探索して領域の初期設定を行う
	//---------------------------------------------------------------------------
	walkElement: function(parent) {
		var notify = this;
		ui.misc.walker(parent, function(el) {
			if (el.nodeType === 1) {
				/* ボタン領域 */
				var role = ui.customAttr(el, "buttonExec");
				if (!!role) {
					pzpr.util.addEvent(
						el,
						!pzpr.env.API.touchevent ? "click" : "mousedown",
						notify,
						notify[role]
					);
				}

				/* タイトルバーでボックスを動かす設定 */
				if (el.className === "titlebar") {
					pzpr.util.addEvent(
						el,
						"mousedown",
						ui.popupmgr,
						ui.popupmgr.titlebardown
					);
				}
			}
		});
	},

	//--------------------------------------------------------------------------------
	// ui.alert()   現在の言語に応じたダイアログを表示する
	// ui.confirm() 現在の言語に応じた選択ダイアログを表示し、結果を返す
	// ui.setVerticalPosition() 指定したエレメントの盾位置を画面中央に設定して表示する
	//--------------------------------------------------------------------------------
	alert: function(strJP, strEN) {
		getEL("notification").innerHTML = ui.selectStr(strJP, strEN);
		this.setVerticalPosition(getEL("assertbox"));
	},
	confirm: function(strJP, strEN, func) {
		getEL("confirmcaption").innerHTML = ui.selectStr(strJP, strEN);
		this.setVerticalPosition(getEL("confirmbox"));
		this.onconfirm = func;
	},
	setVerticalPosition: function(el) {
		var elbg = getEL("notifybg");
		elbg.style.display = "block";
		el.style.display = "inline-block";

		/* innerHeightがIE8以下にないので、代わりに背景要素の高さ(height=100%), 幅を取得します */
		var rect = pzpr.util.getRect(el),
			rectbg = pzpr.util.getRect(elbg);
		el.style.top = (rectbg.height - rect.height) / 2 + "px";
		el.style.left = (rectbg.width - rect.width) / 2 + "px";
	},

	//---------------------------------------------------------------------------
	// notify.closealert()  alertを非表示に戻す
	//---------------------------------------------------------------------------
	closealert: function(e) {
		getEL("assertbox").style.display = "none";
		getEL("notifybg").style.display = "none";
		e.preventDefault();
		e.stopPropagation();
	},

	//---------------------------------------------------------------------------
	// notify.confirmtrue()  confirmでOKが押された時の処理を記入する
	// notify.confirmfalse() confirmでCancelが押されたときの処理を記入する
	//---------------------------------------------------------------------------
	confirmtrue: function(e) {
		if (!!this.onconfirm) {
			this.onconfirm();
		}
		this.onconfirm = null;
		this.confirmfalse(e);
	},
	confirmfalse: function(e) {
		getEL("confirmbox").style.display = "none";
		getEL("notifybg").style.display = "none";
		e.preventDefault();
		e.stopPropagation();
	}
};

// KeyPopup.js v3.4.0
/* global createEL:readonly, getEL:readonly */

//---------------------------------------------------------------------------
// ★KeyPopupクラス マウスからキーボード入力する際のPopupウィンドウを管理する
//---------------------------------------------------------------------------
// キー入力用Popupウィンドウ
ui.keypopup = {
	/* メンバ変数 */
	paneltype: { 1: 0, 3: 0 } /* パネルのタイプ */,
	element: null /* キーポップアップのエレメント */,

	tdcolor: "black" /* 文字の色 */,
	imgCR: [1, 1] /* img表示用画像の横×縦のサイズ */,

	imgs: [] /* resize用 */,

	basepanel: null,
	clearflag: false,

	/* どの文字配置を作成するかのテーブル */
	type: {
		slither: [3, 0],
		nawabari: [4, 0],
		fourcells: [4, 0],
		fivecells: [4, 0],
		fillmat: [4, 0],
		paintarea: [4, 0],
		lightup: [4, 0],
		shakashaka: [4, 0],
		gokigen: [4, 0],
		wagiri: [4, 0],
		shugaku: [4, 0],
		creek: [4, 0],
		ichimaga: [4, 0],
		ichimagam: [4, 0],
		ichimagax: [4, 0],
		sukoro: [4, 4],
		sukororoom: [4, 4],
		lookair: [5, 0],
		tawa: [6, 0],
		hashikake: [8, 0],
		tapa: [8, 0],
		tapaloop: [8, 0],
		amibo: [10, 0],
		cave: [10, 0],
		bdblock: [10, 0],
		country: [10, 0],
		usotatami: [10, 0],
		heyawake: [10, 0],
		ayeheya: [10, 0],
		kurodoko: [10, 0],
		nagenawa: [10, 0],
		ringring: [10, 0],
		numlin: [10, 0],
		nurikabe: [10, 0],
		nuribou: [10, 0],
		mochikoro: [10, 0],
		mochinyoro: [10, 0],
		shikaku: [10, 0],
		aho: [10, 0],
		shimaguni: [10, 0],
		chocona: [10, 0],
		yajitatami: [10, 0],
		tasquare: [10, 0],
		kurotto: [10, 0],
		bonsan: [10, 0],
		heyabon: [10, 0],
		rectslider: [10, 0],
		satogaeri: [10, 0],
		yosenabe: [10, 0],
		herugolf: [10, 0],
		firefly: [10, 0],
		tateyoko: [10, 0],
		factors: [10, 10],
		fillomino: [10, 10],
		symmarea: [10, 10],
		renban: [10, 10],
		ripple: [10, 10],
		cojun: [10, 10],
		makaro: [10, 10],
		sudoku: [10, 10],
		nanro: [10, 10],
		view: [10, 10],
		kakuru: [10, 10],
		kazunori: [10, 10],
		skyscrapers: [10, 10],
		kropki: [10, 10],
		tilepaint: [51, 0],
		triplace: [51, 0],
		kakuro: [51, 10],

		slalom: [101, 0],
		reflect: [102, 0],
		pipelink: [111, 0],
		pipelinkr: [111, 0],
		loopsp: [111, 0],
		tatamibari: [112, 0],
		hakoiri: [113, 113],
		kusabi: [114, 0],
		doppelblock: [10, 115],
		interbd: [116, 0],
		toichika2: [10, 10]
	},

	//---------------------------------------------------------------------------
	// kp.display()     キーポップアップを表示する
	//---------------------------------------------------------------------------
	display: function() {
		var mode = ui.puzzle.editmode ? 1 : 3;
		if (
			this.element &&
			!!this.paneltype[mode] &&
			ui.menuconfig.get("keypopup")
		) {
			this.element.style.display = "block";

			getEL("panelbase1").style.display = mode === 1 ? "block" : "none";
			getEL("panelbase3").style.display = mode === 3 ? "block" : "none";
		} else if (!!this.element) {
			this.element.style.display = "none";
		}
	},

	//---------------------------------------------------------------------------
	// kp.create()      キーポップアップを生成して初期化する
	// kp.createtable() キーポップアップのポップアップを作成する
	//---------------------------------------------------------------------------
	create: function() {
		if (!!this.element) {
			getEL("panelbase1").innerHTML = "";
			getEL("panelbase3").innerHTML = "";
		}

		this.imgs = []; // resize用

		var type = this.type[ui.puzzle.pid];
		if (!type) {
			type = [0, 0];
		}

		this.paneltype = { 1: !ui.puzzle.playeronly ? type[0] : 0, 3: type[1] };
		if (!this.paneltype[1] && !this.paneltype[3]) {
			return;
		}

		if (!this.element) {
			var rect = pzpr.util.getRect(getEL("divques"));
			this.element = getEL("keypopup");
			this.element.style.left = rect.left + 48 + "px";
			this.element.style.top = rect.top + 48 + "px";
			pzpr.util.unselectable(this.element);
		}

		if (this.paneltype[1] !== 0) {
			this.createtable(1);
		}
		if (this.paneltype[3] !== 0) {
			this.createtable(3);
		}

		this.resizepanel();

		var bar = getEL("barkeypopup");
		ui.event.addEvent(bar, "mousedown", ui.popupmgr, ui.popupmgr.titlebardown);
		ui.event.addEvent(bar, "dblclick", ui.menuconfig, function() {
			this.set("keypopup", false);
		});
	},
	createtable: function(mode, type) {
		this.basepanel = getEL("panelbase" + mode);
		this.basepanel.innerHTML = "";

		this.tdcolor = mode === 3 ? ui.puzzle.painter.fontAnscolor : "black";

		this.generate(mode);
	},

	//---------------------------------------------------------------------------
	// kp.generate()    キーポップアップのテーブルを作成する
	// kp.gentable4()   キーポップアップの0～4を入力できるテーブルを作成する
	// kp.gentable10()  キーポップアップの0～9を入力できるテーブルを作成する
	// kp.gentable51()  キーポップアップの[＼],0～9を入力できるテーブルを作成する
	//---------------------------------------------------------------------------
	generate: function(mode) {
		var type = this.paneltype[mode];
		if (type === 4) {
			this.gentable4(mode);
		} else if (type === 10) {
			this.gentable10(mode);
		} else if (type === 51) {
			this.gentable51(mode);
		} else if (type === 3) {
			this.gentable3(mode);
		} else if (type === 5) {
			this.gentable5(mode);
		} else if (type === 6) {
			this.gentable6(mode);
		} else if (type === 8) {
			this.gentable8(mode);
		} else if (type === 101) {
			this.generate_slalom(mode);
		} else if (type === 102) {
			this.generate_reflect(mode);
		} else if (type === 111) {
			this.generate_pipelink(mode);
		} else if (type === 112) {
			this.generate_tatamibari(mode);
		} else if (type === 113) {
			this.generate_hakoiri(mode);
		} else if (type === 114) {
			this.generate_kusabi(mode);
		} else if (type === 115) {
			this.generate_doppelblock();
		} else if (type === 116) {
			this.generate_interbd();
		}
	},
	gentable4: function(mode) {
		var pid = ui.puzzle.pid,
			itemlist = ["1", "2", "3", "4"];
		if (mode === 3 && (pid === "sukoro" || pid === "sukororoom")) {
			var mbcolor = ui.puzzle.painter.mbcolor;
			itemlist.push(
				["q", { text: "○", color: mbcolor }],
				["w", { text: "×", color: mbcolor }],
				" ",
				null
			);
		} else {
			var cap = "?";
			if (ui.puzzle.painter.hideHatena) {
				switch (pid) {
					case "lightup":
					case "shakashaka":
						cap = "■";
						break;
					case "gokigen":
					case "wagiri":
					case "shugaku":
					case "creek":
						cap = "○";
						break;
				}
			}
			itemlist.push("0", null, " ", ["-", cap]);
		}
		this.generate_main(itemlist, 4);
	},
	gentable10: function(mode) {
		var pid = ui.puzzle.pid,
			itemlist = [];
		if (mode === 3 && ui.puzzle.klass.Cell.prototype.numberWithMB) {
			var mbcolor = ui.puzzle.painter.mbcolor;
			itemlist.push(
				["q", { text: "○", color: mbcolor }],
				["w", { text: "×", color: mbcolor }],
				" ",
				null
			);
		}
		if (mode === 1 && (pid === "kakuru" || pid === "tateyoko")) {
			itemlist.push(["q1", "■"], ["w2", "□"], " ", ["-", "?"]);
		}

		itemlist.push("0", "1", "2", "3", "4", "5", "6", "7", "8", "9");
		if (mode === 3 && pid === "toichika2") {
			itemlist.push(["-", { text: "・", color: "rgb(255, 96, 191)" }]);
		}
		itemlist.push(
			mode === 1 || !ui.puzzle.klass.Cell.prototype.numberWithMB ? " " : null
		);

		var cap = null;
		if (mode === 3 || pid === "kakuru" || pid === "tateyoko") {
		} else if (!ui.puzzle.painter.hideHatena) {
			cap = "?";
		} else if (pid === "tasquare") {
			cap = "□";
		} else if (pid === "rectslider") {
			cap = "■";
		} else if (
			pid === "kurotto" ||
			pid === "bonsan" ||
			pid === "satogaeri" ||
			pid === "heyabon" ||
			pid === "yosenabe" ||
			pid === "herugolf" ||
			pid === "kazunori"
		) {
			cap = "○";
		}
		if (cap !== null) {
			itemlist.push(["-", cap]);
		}
		this.generate_main(itemlist, 4);
	},
	gentable51: function(mode) {
		this.generate_main(
			[
				["q", { image: 0 }],
				" ",
				"1",
				"2",
				"3",
				"4",
				"5",
				"6",
				"7",
				"8",
				"9",
				"0"
			],
			4
		);
	},

	//---------------------------------------------------------------------------
	// kp.gentable3()  キーポップアップの0～4を入力できるテーブルを作成する
	// kp.gentable5()  キーポップアップの0～5を入力できるテーブルを作成する
	// kp.gentable6()  キーポップアップの0～6を入力できるテーブルを作成する
	// kp.gentable8()  キーポップアップの0～8を入力できるテーブルを作成する
	//---------------------------------------------------------------------------
	gentable3: function(mode) {
		this.generate_main(["1", "2", "3", "0", " ", ["-", "?"]], 3);
	},
	gentable5: function(mode) {
		this.generate_main(
			["1", "2", "3", "4", "5", null, "0", " ", ["-", "?"]],
			3
		);
	},
	gentable6: function(mode) {
		this.generate_main(["1", "2", "3", "4", "5", "6", "0", " ", ["-", "?"]], 3);
	},
	gentable8: function(mode) {
		if (ui.puzzle.pid !== "tapa" && ui.puzzle.pid !== "tapaloop") {
			this.generate_main(
				["1", "2", "3", "4", "5", "6", "7", "8", " ", ["-", "○"]],
				4
			);
		} else {
			this.generate_main(
				["1", "2", "3", "4", "5", "6", "7", "8", "0", " ", ["-", "?"]],
				4
			);
		}
	},

	//---------------------------------------------------------------------------
	// kp.generate_slalom()     スラローム用のテーブルを作成する
	// kp.generate_reflect()    リフレクトリンク用のテーブルを作成する
	//---------------------------------------------------------------------------
	generate_slalom: function(mode) {
		this.imgCR = [4, 1];
		this.generate_main(
			[
				["q", { image: 0 }],
				["s", { image: 1 }],
				["w", { image: 2 }],
				["e", { image: 3 }],
				["r", " "],
				"1",
				"2",
				"3",
				"4",
				"5",
				"6",
				"7",
				"8",
				"9",
				"0",
				"-",
				" "
			],
			5
		);
	},
	generate_reflect: function(mode) {
		this.imgCR = [4, 1];
		this.generate_main(
			[
				["q", { image: 0 }],
				["w", { image: 1 }],
				["e", { image: 2 }],
				["r", { image: 3 }],
				["t", "╋"],
				["y", " "],
				"1",
				"2",
				"3",
				"4",
				"5",
				"6",
				"7",
				"8",
				"9",
				"0",
				"-"
			],
			6
		);
	},

	//---------------------------------------------------------------------------
	// kp.generate_pipelink()   パイプリンク、帰ってきたパイプリンク、環状線スペシャル用のテーブルを作成する
	// kp.generate_tatamibari() タタミバリ用のテーブルを作成する
	// kp.generate_hakoiri()    はこいり○△□用のテーブルを作成する
	// kp.generate_kusabi()     クサビリンク用のテーブルを作成する
	//---------------------------------------------------------------------------
	generate_pipelink: function(mode) {
		var pid = ui.puzzle.pid,
			itemlist = [];
		itemlist.push(
			["q", "╋"],
			["w", "┃"],
			["e", "━"],
			["r", " "],
			pid !== "loopsp" ? ["-", "?"] : null,
			["a", "┗"],
			["s", "┛"],
			["d", "┓"],
			["f", "┏"]
		);
		if (pid === "pipelink") {
			itemlist.push(null);
		} else if (pid === "pipelinkr") {
			itemlist.push(["1", "○"]);
		} else if (pid === "loopsp") {
			itemlist.push(["-", "○"]);
		}

		if (pid === "loopsp") {
			itemlist.push("1", "2", "3", "4", "5", "6", "7", "8", "9", "0");
		}
		this.generate_main(itemlist, 5);
	},
	generate_tatamibari: function(mode) {
		this.generate_main(
			[
				["q", "╋"],
				["w", "┃"],
				["e", "━"],
				["r", " "],
				["-", "?"]
			],
			3
		);
	},
	generate_hakoiri: function(mode) {
		this.generate_main(
			[
				["1", "○"],
				["2", "△"],
				["3", "□"],
				[
					"4",
					{
						text: mode === 1 ? "?" : "・",
						color: mode === 3 ? "rgb(255, 96, 191)" : ""
					}
				],
				" "
			],
			3
		);
	},
	generate_kusabi: function(mode) {
		this.generate_main(
			[["1", "同"], ["2", "短"], ["3", "長"], ["-", "○"], " "],
			3
		);
	},
	generate_doppelblock: function() {
		this.generate_main(
			[
				"1",
				"2",
				"3",
				"4",
				"5",
				"6",
				"7",
				"8",
				"9",
				"0",
				["q", "⋅"],
				["w", "■"],
				" "
			],
			5
		);
	},
	generate_interbd: function() {
		this.generate_main(
			[
				"1",
				"2",
				"3",
				"4",
				"0",
				["-", { text: "?", color: "gray" }],
				["q", { text: "●", color: "red" }],
				["w", { text: "◆", color: "blue" }],
				["e", { text: "▲", color: "green" }],
				["r", { text: "■", color: "#c000c0" }],
				["t", { text: "⬟", color: "#ff8000" }],
				["y", { text: "⬣", color: "#00c0c0" }],
				" "
			],
			4
		);
	},

	generate_main: function(list, split) {
		for (var i = 0; i < list.length; i++) {
			this.inputcol(list[i]);
			if ((i + 1) % split === 0) {
				this.insertrow();
			}
		}
		if (i % split !== 0) {
			this.insertrow();
		}
	},

	//---------------------------------------------------------------------------
	// kp.inputcol()  テーブルのセルを追加する
	// kp.insertrow() テーブルの行を追加する
	//---------------------------------------------------------------------------
	inputcol: function(item) {
		var type = "num",
			ca,
			disp,
			color = this.tdcolor;
		if (!item) {
			type = "empty";
		} else {
			if (typeof item === "string") {
				ca = disp = item;
			} else if (typeof item[1] === "string") {
				ca = item[0];
				disp = item[1];
			} else if (!!item[1].text) {
				ca = item[0];
				disp = item[1].text;
				color = item[1].color;
			} else if (item[1].image !== void 0) {
				ca = item[0];
				disp = item[1].image;
				type = "image";
			}
		}

		var _div = null,
			_child = null;
		if (type !== "empty") {
			_div = createEL("div");
			_div.className = "kpcell kpcellvalid";
			_div.onclick = function(e) {
				e.preventDefault();
			};
			ui.event.addEvent(_div, "mousedown", ui.puzzle, function(e) {
				this.key.keyevent(ca, 0);
				e.preventDefault();
				e.stopPropagation();
			});
			pzpr.util.unselectable(_div);
		} else {
			_div = createEL("div");
			_div.className = "kpcell kpcellempty";
			pzpr.util.unselectable(_div);
		}

		if (type === "num") {
			_child = createEL("span");
			_child.className = "kpnum";
			_child.style.color = color;
			_child.innerHTML = disp;
			pzpr.util.unselectable(_child);
		} else if (type === "image") {
			_child = createEL("img");
			_child.className = "kpimg";
			var pid = ui.puzzle.pid;
			_child.src =
				"data:image/gif;base64," +
				this.dataurl[!!this.dataurl[pid] ? pid : "shitappa"];
			pzpr.util.unselectable(_child);
			var x = disp % this.imgCR[0],
				y = (disp - x) / this.imgCR[1];
			this.imgs.push({ el: _child, x: x, y: y });
		}

		if (this.clearflag) {
			_div.style.clear = "both";
			this.clearflag = false;
		}
		if (!!_child) {
			_div.appendChild(_child);
		}
		this.basepanel.appendChild(_div);
	},
	insertrow: function() {
		this.clearflag = true;
	},

	//---------------------------------------------------------------------------
	// kp.resizepanel() キーポップアップのセルのサイズを変更する
	//---------------------------------------------------------------------------
	resizepanel: function() {
		var cellsize = Math.min(ui.puzzle.painter.cw, 120);
		if (cellsize < 20) {
			cellsize = 20;
		}

		var dsize = (cellsize * 0.9) | 0,
			tsize = (cellsize * 0.7) | 0;
		for (var i = 0, len = this.imgs.length; i < len; i++) {
			var obj = this.imgs[i],
				img = obj.el;
			img.style.width = "" + dsize * this.imgCR[0] + "px";
			img.style.height = "" + dsize * this.imgCR[1] + "px";
			img.style.clip =
				"rect(" +
				(dsize * obj.y + 1) +
				"px," +
				dsize * (obj.x + 1) +
				"px," +
				dsize * (obj.y + 1) +
				"px," +
				(dsize * obj.x + 1) +
				"px)";
			img.style.top = "-" + obj.y * dsize + "px";
			img.style.left = "-" + obj.x * dsize + "px";
		}

		ui.misc.modifyCSS({
			"div.kpcell": {
				width: "" + dsize + "px",
				height: "" + dsize + "px",
				lineHeight: "" + dsize + "px"
			},
			"span.kpnum": { fontSize: "" + tsize + "px" }
		});
	},

	dataurl: {
		slalom:
			"R0lGODlhAAFAAMIEAAICAmBgYJ+fn///////AP//AP//AP//ACH5BAEKAAQALAAAAAAAAUAAAAP+OLrc/jDKSau9OOvNu/9gKI5kaZ5oqq5s675wLM90bd94ru+24AdAH68BKBqHNqNyyWw6n9DSD2oMCHhMZI3K7XqLI0Hgq7TmstoZec0GhMTt8jW5TKvj+OhnnFfOaWh2MH2EdR0ChUtmd0qCMYmJHXxOQFZ/P5OUjEeOL5CFHJmKfxFTmp2oIZ+EG6JVpBVwTQGptR2rfRquAIsbiLO2wRi4eRm7tB+yS7DCzQ7EeBi/yyO7zCiBziTQcRfTfiWuyCzZ2iLcbReu1yDrLeXmIOhsFt9F7CGu74bx5/NkFkSNO2EPAL4R8Prd+vclFpODbxKWkKhQA8OGFAS2EAX+UR6/ih4ueqFQsGPEMiCDieySUZGLkilrreTSEpwLjjFTzaRCweULewNz2tmpR4JPTyhTUBQ6geiTCUBjiFKxlGkEp06gUoMxVelHqxawNpmAE4Y9kxyqevw4dkFbt+XeQhBbtezPrSfUfpDLN67fr8/oNpLQ1SxeE3pDZuv7Ve4Ax4EFgyF8uMVZr4MxZ368+O9mzoCJSJ5cqjILeyAZb3bMuupo0hAucw3tTDUnBa0bu36tNemLwmCRvHbT1Lflo8GHDO9JG0XU5MJ5kzWdwm7e5tBFjyaJXAVMzbCzX5Ve3OaK5+CJizdKnrLx9GgXfl4fWbJD6iQ0rkgMfXmvBX0pfEcVdvT5x113+SF43Xz0MWBgTeYliF+DgLTH3IShMBEUhTc8eCCGxjQRH4fkWAjhe744MSKJ+5l4YoQhisjiDh4GRMmKBRmx4lq3zQiafa08YQlUu+goA3/J1agOFUH44CQQXOyoCoHrKelNkXj08giV4lkpTSJaHslldl5Kg2UXYW4SHotlapAjk1Iu2KOPVplCyZB05pmDk0Lo6eefgAYq6KCEFmrooSwkAAA7",
		reflect:
			"R0lGODlhAAFAAIABAAAAAP///yH5BAEKAAEALAAAAAAAAUAAAAL+jI+py+0Po5y02ouz3rz7D4biSJbmiabqyrbuC8fyTNf2jef6bgD8H/A9AMSi8YhMKpdJCPMJjSKdQiCOGJFqt9Mh96vNYq22ogSMflLT7OPZTJ4ZJ+362GGv0+dxmHufh7YW+EXR1cdy+EbINcgoVdGEqCJp+BjmdRlloTSJ0smpCeUoWmlp6hmyhFHKRNoKFwqaCuLKCqvIgJt7OkvLoZaxy4c3fHcx+ruRLGz8WrrMrCxrq+GciQu8OR25HZ2N3dqByS3m/S0eLuqxVf7si76ufvnR6K7bXp9eDK2ff4+gUK1+/DSpEggwCEJ/9OYFEiEIYMSDDQsyGpHmXkb+jBUbGOQ4URmbEh3xXSTRZlpKkict2jGhh1ZMlg8dbqQ50tPLE4Tegfm0s0+eFDVd3oQ5NE5RnkE9NkWaFEhPSjOdriQ6lUdLrDmN2qOaNcejFlethuQatsxYskdN/mS7Vm3cRGcXtAU7V4Y8F3UV9EWb9wVBvgvdkiO8V/BgxIcNn2P8EXJJycG8rtILi3JgzfDsNlacecWuGp/9QqIxDO8+OY89S8M8mmls0q9dV0N9DWVu2rcd84KdGmTwG5XNosJtrArD4cQvW1YuN/nA5NCj/7G8g3qseLuvHDf9m7d2bdqrN79u/JjY8uq7sZeK3jF89ubNvZ/fHnx+7/Q96z9nrtV2bpHRn4A2SUfgfgEpyF+BiziolH8HMNgghP8hqJQTCW3IYYcefghiiCKOSGKJJp6IYooqrlhOAQA7",
		shitappa:
			"R0lGODlhQABAAIABAAAAAP//ACH5BAEKAAEALAAAAABAAEAAAAL6jI+py+0Po5y02ouz3rz7DwHiSJbmiaZnqLbuW7LwTMdPjdcyCUb8veo5fkOUsEFEjgK2YyLJ+DWdBuiCOHVaFcmscPtcIrwg8Fh8Rn/VUXbVvIG/RW13R860z+k9PJys4ad3AIghyFc0aHEI4IMnwQj5uEMpqWjZCIToeFmZmDlRyAmqtIlJWhG5OMnVyRrWeeUaW2c66nkhKmvbykuhC4u6K7xKm+ebRlyMHIwb+Kh6F12qbCg3La2InY28za3s/T3sXGYV7pF1jt41y7yOpv5hEy/PQ18f9Ek1fF8OnAPwxY6ABP8VPMgIYcF9DBs6fAgxosSJFBMUAAA7"
	}
};

// Timer.js v3.4.0

(function() {
	//---------------------------------------------------------------------------
	// ★Timerクラス  一般タイマー(経過時間の表示/自動正答判定用)
	//---------------------------------------------------------------------------
	var timerInterval = 100; /* タイマー割り込み間隔 */

	ui.timer = {
		/* メンバ変数 */
		TID: null /* タイマーID */,
		current: 0 /* 現在のgetTime()取得値(ミリ秒) */,

		/* 経過時間表示用変数 */
		bseconds: 0 /* 前回ラベルに表示した時間(秒数) */,
		timerEL: null /* 経過時間表示用要素 */,

		/* 自動正答判定用変数 */
		worstACtime: 0 /* 正答判定にかかった時間の最悪値(ミリ秒) */,
		nextACtime: 0 /* 次に自動正答判定ルーチンに入ることが可能になる時間 */,

		//---------------------------------------------------------------------------
		// tm.reset()      タイマーのカウントを0にして、スタートする
		// tm.start()      update()関数を200ms間隔で呼び出す
		// tm.update()     200ms単位で呼び出される関数
		//---------------------------------------------------------------------------
		init: function() {
			this.worstACtime = 0;
			this.timerEL = document.getElementById("timerpanel");
			this.showtime(0);
		},
		start: function() {
			var self = this;
			if (!!this.TID) {
				return;
			}
			ui.puzzle.resetTime();
			this.update();
			this.TID = setInterval(function() {
				self.update();
			}, timerInterval);
		},
		stop: function() {
			if (!this.TID) {
				return;
			}
			clearInterval(this.TID);
			this.TID = null;
		},
		update: function() {
			this.current = pzpr.util.currentTime();

			if (ui.puzzle.playeronly) {
				this.updatetime();
			}
			if (ui.menuconfig.get("autocheck_once")) {
				var mode = ui.menuconfig.get("autocheck_mode");
				this.autocheck(mode === "guarded");
			}
		},

		//---------------------------------------------------------------------------
		// tm.updatetime() 秒数の表示を行う
		// tm.label()      経過時間に表示する文字列を返す
		//---------------------------------------------------------------------------
		showtime: function(seconds) {
			var hours = (seconds / 3600) | 0;
			var minutes = ((seconds / 60) | 0) - hours * 60;
			seconds = seconds - minutes * 60 - hours * 3600;

			if (minutes < 10) {
				minutes = "0" + minutes;
			}
			if (seconds < 10) {
				seconds = "0" + seconds;
			}

			this.timerEL.innerHTML = [
				this.label(),
				!!hours ? hours + ":" : "",
				minutes,
				":",
				seconds
			].join("");
		},
		updatetime: function() {
			var seconds = (ui.puzzle.getTime() / 1000) | 0;
			if (this.bseconds === seconds) {
				return;
			}
			this.showtime(seconds);
			this.bseconds = seconds;
		},
		label: function() {
			return ui.selectStr("経過時間：", "Time: ");
		},

		//---------------------------------------------------------------------------
		// tm.autocheck()    自動正解判定を呼び出す
		//---------------------------------------------------------------------------
		autocheck: function(guarded) {
			var puzzle = ui.puzzle;
			if (
				this.current > this.nextACtime &&
				puzzle.playmode &&
				!puzzle.checker.inCheck &&
				puzzle.board.trialstage === 0 &&
				!puzzle.getConfig("variant")
			) {
				var check = puzzle.check(false);
				if (check.complete && (!guarded || !check.undecided)) {
					ui.timer.stop();
					puzzle.mouse.mousereset();
					ui.menuconfig.set("autocheck_once", false);
					if (ui.callbackComplete) {
						ui.callbackComplete(puzzle, check);
					}
					ui.notify.alert("正解です！", "Complete!");
					return;
				}

				this.worstACtime = Math.max(
					this.worstACtime,
					pzpr.util.currentTime() - this.current
				);
				this.nextACtime =
					this.current +
					(this.worstACtime < 250
						? this.worstACtime * 4 + 120
						: this.worstACtime * 2 + 620);
			}
		}
	};

	//---------------------------------------------------------------------------
	// ★UndoTimerクラス   Undo/Redo用タイマー
	//---------------------------------------------------------------------------
	var undoTimerInterval = 25 /* タイマー割り込み間隔 */,
		execWaitTime = 300; /* 1回目にwaitを多く入れるための値 */

	ui.undotimer = {
		/* メンバ変数 */
		TID: null /* タイマーID */,

		inUNDO: false /* Undo実行中 */,
		inREDO: false /* Redo実行中 */,

		//---------------------------------------------------------------------------
		// ut.reset()  タイマーをスタートする
		//---------------------------------------------------------------------------
		reset: function() {
			this.stop();
		},

		//---------------------------------------------------------------------------
		// ut.startUndo() Undo開始共通処理
		// ut.startRedo() Redo開始共通処理
		// ut.stopUndo() Undo停止共通処理
		// ut.stopRedo() Redo停止共通処理
		//---------------------------------------------------------------------------
		startUndo: function() {
			if (!(this.inUNDO || this.inREDO)) {
				this.inUNDO = true;
				this.proc();
			}
		},
		startRedo: function() {
			if (!(this.inREDO || this.inUNDO)) {
				this.inREDO = true;
				this.proc();
			}
		},
		stopUndo: function() {
			if (this.inUNDO) {
				this.inUNDO = false;
				this.proc();
			}
		},
		stopRedo: function() {
			if (this.inREDO) {
				this.inREDO = false;
				this.proc();
			}
		},

		//---------------------------------------------------------------------------
		// ut.start() Undo/Redo呼び出しを開始する
		// ut.stop()  Undo/Redo呼び出しを終了する
		//---------------------------------------------------------------------------
		start: function() {
			var self = this;
			function handler() {
				self.proc();
			}
			function inithandler() {
				clearInterval(self.TID);
				self.TID = setInterval(handler, undoTimerInterval);
			}
			this.TID = setInterval(inithandler, execWaitTime);
			this.exec();
		},
		stop: function() {
			this.inUNDO = false;
			this.inREDO = false;

			clearInterval(this.TID);
			this.TID = null;
		},

		//---------------------------------------------------------------------------
		// ut.proc()  Undo/Redo呼び出しを実行する
		// ut.exec()  Undo/Redo関数を呼び出す
		//---------------------------------------------------------------------------
		proc: function() {
			if ((this.inUNDO || this.inREDO) && !this.TID) {
				this.start();
			} else if (!(this.inUNDO || this.inREDO) && !!this.TID) {
				this.stop();
			} else if (!!this.TID) {
				this.exec();
			}
		},
		exec: function() {
			if (!this.checknextprop()) {
				this.stop();
			} else if (this.inUNDO) {
				ui.puzzle.undo();
			} else if (this.inREDO) {
				ui.puzzle.redo();
			}
		},

		//---------------------------------------------------------------------------
		// ut.checknextprop()  次にUndo/Redoができるかどうかの判定を行う
		//---------------------------------------------------------------------------
		checknextprop: function() {
			var opemgr = ui.puzzle.opemgr;
			var isenable =
				(this.inUNDO && opemgr.enableUndo) ||
				(this.inREDO && opemgr.enableRedo);
			return isenable;
		}
	};
})();

/* jshint devel:true */
/* global ui:false, getEL:readonly */

ui.popupmgr.addpopup("auxeditor", {
	formname: "auxeditor",

	close: function() {
		if (ui.auxeditor.cb && ui.auxeditor.puzzle) {
			ui.auxeditor.cb(ui.auxeditor.puzzle);
			ui.auxeditor.cb = null;
		}
		ui.auxeditor.current = null;

		ui.popupmgr.popups.template.close.apply(this);
	},

	init: function() {
		ui.popupmgr.popups.template.init.call(this);

		function btnfactory(role) {
			return function(e) {
				ui.toolarea[role](e);
				if (e.type !== "click") {
					e.preventDefault();
					e.stopPropagation();
				}
			};
		}
		function addbtnevent(el, type, role) {
			pzpr.util.addEvent(el, type, ui.toolarea, btnfactory(role));
		}

		ui.misc.walker(this.form, function(el) {
			if (el.nodeType === 1) {
				if (el.className === "config") {
					ui.toolarea.items[ui.customAttr(el, "config")] = { el: el };
				} else if (el.className.match(/child/)) {
					var parent = el.parentNode.parentNode,
						idname = ui.customAttr(parent, "config");
					var item = ui.toolarea.items[idname];
					if (!item.children) {
						item.children = [];
					}
					item.children.push(el);

					addbtnevent(el, "mousedown", "toolclick");
				}
			}
		});
	}
});

ui.auxeditor = {
	current: null,
	cb: null,

	open: function(sender, args, cb) {
		if (ui.auxeditor.current === args.key) {
			return;
		}

		var cellsize = ui.puzzle.painter.cw;
		if (cellsize > 32) {
			cellsize = Math.floor(cellsize * 0.75);
		}

		var rect = pzpr.util.getRect(getEL("divques"));
		ui.popupmgr.open("auxeditor", 4, rect.top);

		if (!ui.auxeditor.puzzle) {
			var element = document.getElementById("divauxeditor");
			ui.auxeditor.puzzle = new pzpr.Puzzle(element, {
				type: "player",
				cellsize: cellsize
			});
		}
		var pz = ui.auxeditor.puzzle;

		pz.open(args.pid + "/" + args.url, function() {
			ui.popupmgr.popups.auxeditor.titlebar.innerText = ui.selectStr(
				pz.info.ja,
				pz.info.en
			);
			ui.auxeditor.puzzle.setCanvasSizeByCellSize(cellsize);

			var bounds = pzpr.util.getRect(getEL("popauxeditor"));
			ui.popupmgr.open(
				"auxeditor",
				Math.max(4, rect.left - bounds.width),
				bounds.top
			);
		});

		ui.auxeditor.current = args.key;
		ui.auxeditor.cb = cb;
		ui.menuconfig.set("auxeditor_inputmode", "auto");
	}
};

(function() {
	ui.network = {
		ws: null,
		mode: "",
		key: "",
		maxSeen: -1,

		configure: function(mode, key) {
			this.mode = mode;
			this.key = key;
			ui.setdisplay("network");
		},

		start: function() {
			if (!this.mode) {
				return;
			}

			var loc = window.location;
			var wsurl = "ws://";
			if (document.location.protocol === "https:") {
				wsurl = "wss://";
			}
			wsurl = wsurl + loc.host + "/game/" + this.key;

			this.ws = new WebSocket(wsurl);
			this.ws.onclose = this.onclose;
			this.ws.onmessage = this.onmessage;
		},

		onCellOp: function(op) {
			if (!!this.ws) {
				this.ws.send(op);
			}
		},

		onclose: function(event) {
			ui.network.start();
		},

		onmessage: function(event) {
			var msg = JSON.parse(event.data);
			var id = msg.id;
			if (id > ui.network.maxSeen) {
				ui.network.maxSeen = id;
				ui.network.applyOp(msg.operation);
			}
		},

		applyOp: function(encOp) {
			var op = new ui.puzzle.klass.ObjectOperation();
			op.decode(encOp.split(","));
			op.external = true;

			ui.puzzle.opemgr.disableRecord();
			op.redo();
			ui.puzzle.opemgr.enableRecord();

			ui.puzzle.opemgr.newOperation();
			ui.puzzle.opemgr.add(op);
		}
	};
})();

// outro.js

})();

//# sourceMappingURL=pzpr-ui.concat.js.map