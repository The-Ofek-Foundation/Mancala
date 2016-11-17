var docWidth, docHeight;
var pits;
var seedsPerPit;
var board, boardCopy;
var topTurnGlobal;
var monteCarloTrials;
var aiTurn;
var capturingRules;
var reverseDrawing;
var lastCaptureGlobal, lastMoveGlobal, lastSowGlobal;
var globalRoot;
var expansionConstant;
var boardStates, stateOn;
var ponder, pondering;
var lastRec;
var certaintyThreshold;
var monteCarloAide = false;
var drawWeights;
var maxTrials = 1500000; // prevents overload (occurs around 2.3 million)
var wrapperTop;
var numChoose1, numChoose2, numChoose3, lnc1, lnc2, lnc3, stopChoose;

var boardui = getElemId('board');
var brush = boardui.getContext('2d');
var centerDiv = getElemId('center-div');
var analElem = getElemId('anal'), numTrialsElem = getElemId('num-trials');

function pageReady() {
	resizeBoard();
	newGame();
	setTimeout(resizeButtons, 0);
	setTimeout(resizeGameSettingsTable, 0);
}

function resizeBoard() {
	docWidth = getElemWidth(contentWrapper);
	docHeight = getElemHeight(contentWrapper);
	wrapperTop = contentWrapper.offsetTop;

	setElemWidth(boardui, docWidth);
	setElemHeight(boardui, docHeight);
	boardui.setAttribute('width', docWidth);
	boardui.setAttribute('height', docHeight);

	ovalWidth = docWidth / (pits + 3);
	ovalHeight = docHeight / 5;

	resizeButtons();
	resizeGameSettingsTable();
}

function resizeButtons() {
	setElemWidth(centerDiv, ovalWidth * pits);
	setElemHeight(centerDiv, ovalHeight);
	var cBs = centerDiv.children, width = ovalWidth * pits + 1,
		fontSize = docHeight / 10;
	while (width > ovalWidth * pits) {
		width = 0;
		for (var i = 0, elem = cBs[i]; i < cBs.length; i++, elem = cBs[i]) {
			setElemStyle(elem, 'font-size', fontSize + "px");
			width += getElemWidth(elem);
		}
		fontSize--;
	}
	centerElem(centerDiv);
	centerVertically(getElemId('undo-btn'));
	fitParent();
}

function onResize() {
	resizeBoard();
	drawBoard();
}

function newGame() {
	getSettings();
	populateSettingsForm(gameSettings.getSettings());

	board = new Array(pits * 2 + 2);
	for (var i = 0; i < pits * 2 + 2; i++)
		board[i] = seedsPerPit;
	board[0] = board[pits + 1] = 0;
	topTurnGlobal = true;
	lastSowGlobal = lastCaptureGlobal = lastMoveGlobal = -1;
	boardStates = [];
	stateOn = 0;
	saveBoardState(stateOn);
	lastRec = null;
	globalRoot = createMCTSRoot();
	numChoose1 = numChoose2 = numChoose3 = lnc1 = lnc2 = lnc3 = stopChoose = false;

	ovalWidth = docWidth / (pits + 3);
	ovalHeight = docHeight / 5;
	drawBoard();

	if (aiTurn === 'first' || aiTurn === 'both')
		setTimeout(playMonteCarloAiMove, 30);

	stopPonder();
	if (ponder)
		startPonder();
}

function getSettings() {
	pits = gameSettings.getOrSet('pits', 6);
	seedsPerPit = gameSettings.getOrSet('seedsPerPit', 4);
	ponder = gameSettings.getOrSet('ponder', false);
	drawWeights = gameSettings.getOrSet('drawWeights', false);
	capturingRules = gameSettings.getOrSet('capturingRules',
		"Same Side and Opposite Occupied");
	reverseDrawing = gameSettings.getOrSet('reverseDrawing', true)
	aiTurn = gameSettings.getOrSet('aiTurn', 'second');
	monteCarloTrials = gameSettings.getOrSet('monteCarloTrials', 200000)
	expansionConstant = gameSettings.getOrSet('expansionConstant', 3.5)
	certaintyThreshold = gameSettings.getOrSet('certaintyThreshold', 0.5)
}

function populateSettingsForm(settings) {
	setInputValue('num-pits', pits);
	setInputValue('seeds-per-pit', seedsPerPit);
	setInputValue('ai-ponder', ponder);
	setInputValue('mc-weight', drawWeights);
	setInputValue('capture-rules', capturingRules);
	setInputValue('reverse', reverseDrawing);
	setInputValue('ai-turn', aiTurn);
	setInputValue('mc-trials', monteCarloTrials);
	setInputValue('mc-expansion', expansionConstant);
	setInputValue('mc-certainty', 100 * (1 - certaintyThreshold));
}

function playMove(pitLoc) {

	if (!sow(pitLoc)) {
		topTurnGlobal = !topTurnGlobal;
		numChoose1 = numChoose2 = numChoose3 = stopChoose = false;
	}

	if(endGame(topTurnGlobal))
		if (ponder)
			stopPonder();

	stateOn++;
	saveBoardState(stateOn);

	globalRoot = MCTSGetNextRoot(pitLoc);
	if (globalRoot)
		globalRoot.parent = null;
	else globalRoot = createMCTSRoot();

	updateAnalysis();

	drawBoard();

	if (aiTurn == 'both' || (aiTurn == 'first' && topTurnGlobal) || (aiTurn == 'second' && !topTurnGlobal))
		setTimeout(playMonteCarloAiMove, 30);
}

function saveBoardState(index) {
	boardStates = boardStates.slice(0, index);
	boardStates[index] = new State(board.slice(0), topTurnGlobal);
	boardStates[index].lastCaptureGlobal = lastCaptureGlobal;
	boardStates[index].lastMoveGlobal = lastMoveGlobal;
	boardStates[index].lastSowGlobal = lastSowGlobal;
}

function loadBoardState(index) {
	board = boardStates[index].board.slice(0);
	topTurnGlobal = boardStates[index].turn;
	numChoose1 = numChoose2 = numChoose3 = stopChoose = false;
	lastCaptureGlobal = boardStates[index].lastCaptureGlobal;
	lastMoveGlobal = boardStates[index].lastMoveGlobal;
	lastSowGlobal = boardStates[index].lastSowGlobal;
}

function undo() {
	if (stateOn === 0) {
		alert("No moves left to undo!");
		return;
	}
	stateOn--;
	loadBoardState(stateOn);
	globalRoot = null;
	drawBoard();
	if (pondering) {
		stopPonder();
		startPonder();
	}
}

function redo() {
	if (stateOn >= boardStates.length - 1) {
		alert("No moves left to redo!");
		return;
	}
	stateOn++;
	loadBoardState(stateOn);
	drawBoard();
}

function startPonder() {
	pondering = setInterval(function() {
		if (!globalRoot)
			globalRoot = createMCTSRoot();
		var startTime = new Date().getTime();
		var tempCount = 0;
		while ((new Date().getTime() - startTime) < 30 && !stopChoose) {
			globalRoot.chooseChild();
			tempCount++;
		}
		if (numChoose3 && (tempCount < numChoose3 / 10 || tempCount < numChoose2 / 10 || tempCount < numChoose1 / 10))
			stopChoose = true;
		else {
			numChoose3 = numChoose2;
			numChoose2 = numChoose1;
			numChoose1 = tempCount;
		}
		lastRec = mostTriedChild(globalRoot, null);
		updateAnalysis();
		if (drawWeights && Math.random() > 0.9)
			drawBoard();
	}, 1);
}

function updateAnalysis() {
	var range = getMCTSDepthRange();
	analElem.innerHTML = "Analysis: Best-" + range[1] +" Worst-" + range[0] + " Result-" + range[2];
	numTrialsElem.innerHTML =  "Trials: " + globalRoot.totalTries;
}

function stopPonder() {
	clearInterval(pondering);
}

function createMCTSRoot() {
	return new MCTSNode(new State(board, topTurnGlobal), null, null);
}

function MCTSGetNextRoot(pitLoc) {
	if (!globalRoot || !globalRoot.children)
		return null;
	for (var i = 0; i < globalRoot.children.length; i++)
		if (globalRoot.children[i].lastMove == pitLoc) {
			return globalRoot.children[i];
		}
	return null;
}

function runMCTS(times, threshold, callback) {
	if (!globalRoot)
		globalRoot = createMCTSRoot();
	runMCTSRecursive(times, threshold, 10, 10, callback);
}

function runMCTSRecursive(times, threshold, timeOn, totalTimes, callback) {
	for (var a = 0; a < times / totalTimes; a++)
		globalRoot.chooseChild();
//	 if (lastRec != mostTriedChild(globalRoot, null)) {
		lastRec = mostTriedChild(globalRoot, null);
		updateAnalysis();
		if (drawWeights)
			drawBoard();
//	 }
	if (threshold > 0) {
		if (globalRoot.children.length < 2) {
			callback(globalRoot);
			return;
		}
		var cert = getCertainty(globalRoot);
		console.log(cert, threshold);
		if (cert < threshold) {
			callback(globalRoot);
			return;
		}
	}
	if (timeOn <= 1)
		callback(globalRoot);
	else setTimeout(function() {
		runMCTSRecursive(times, threshold, timeOn - 1, totalTimes, callback);
	}, 30);
}

function getCertainty(root) {
	var bestChild = mostTriedChild(root, null);
	var ratio = mostTriedChild(root, bestChild).totalTries / bestChild.totalTries;
	var ratioWins = bestChild.hits < bestChild.misses ? (bestChild.hits / bestChild.misses * 2):(bestChild.misses / bestChild.hits * 3);
	return ratio > ratioWins ? ratioWins:ratio;
}

function mostTriedChild(root, exclude) {
	var mostTrials = 0, child = null;
	if (!root.children)
		return null;
	if (root.children.length == 1)
		return root.children[0];
	for (var i = 0; i < root.children.length; i++)
		if (root.children[i] != exclude && root.children[i].totalTries > mostTrials) {
			mostTrials = root.children[i].totalTries;
			child = root.children[i];
		}
	return child;
}

function leastTriedChild(root) {
	var leastTrials = root.totalTries + 1, child = null;
	if (!root.children)
		return null;
	for (var i = 0; i < root.children.length; i++)
		if (root.children[i].totalTries < leastTrials) {
			leastTrials = root.children[i].totalTries;
			child = root.children[i];
		}
	return child;
}

function getBestMoveMCTS(callback) {
	var bestChild;
	if (callback && globalRoot.totalTries < monteCarloTrials) {
		runMCTS(monteCarloTrials - globalRoot.totalTries, certaintyThreshold, function() {
//			 console.log("finish");
			bestChild = mostTriedChild(globalRoot, null);
			if (!bestChild)
				callback(-1);
			else callback(bestChild.lastMove);
		});
	} else if (callback) {
		bestChild = mostTriedChild(globalRoot, null);
		if (!bestChild)
			callback(-1);
		else callback(bestChild.lastMove);
	} else {
		bestChild = mostTriedChild(globalRoot, null);
		if (!bestChild)
			return -1;
		return bestChild.lastMove;
	}
}

function getMCTSDepthRange() {
	var root, range = new Array(3);
	for (range[0] = -1, root = globalRoot; root && root.children; range[0]++, root = leastTriedChild(root));
	for (range[1] = -1, root = globalRoot; root && root.children; range[1]++, root = mostTriedChild(root));
	root = globalRoot;
	if (root.totalTries > (root.hits + root.misses) * 2)
		range[2] = "Tie";
	else if ((root.hits > root.misses) == topTurnGlobal)
		range[2] = 'first';
	else if ((root.hits < root.misses) == topTurnGlobal)
		range[2] = 'second';
	else range[2] = "Tie";
	return range;
}

function analyzePosition(topTurn) {
	return (topTurn ? (board[pits + 1] - board[0]):(board[0] - board[pits + 1]));
}

function MCTSAnalyzePosition(tboard, topTurn) {
	return (topTurn ? (tboard[pits + 1] - tboard[0]):(tboard[0] - tboard[pits + 1]));
}

function MCTSGetChildren(state, father) {
	var tempBoard = state.board.slice(0);
	var topTurn = state.turn;
	var i;

	var possibleMoves = [];
	for (i = 0; i < pits; i++)
		if (!MCTSIllegalMove(tempBoard, i + (topTurn ? 1:(2 + pits)), topTurn))
			possibleMoves[possibleMoves.length] = i + (topTurn ? 1:(2 + pits));

	var possibleChildren = new Array(possibleMoves.length);

	for (i = 0; i < possibleChildren.length; i++) {
		if (!MCTSSow(tempBoard, possibleMoves[i]))
			topTurn = !topTurn;
		MCTSEndGame(tempBoard, topTurn);
		possibleChildren[i] = new MCTSNode(new State(tempBoard, topTurn), father, possibleMoves[i]);

		tempBoard = state.board.slice(0);
		topTurn = state.turn;
	}

	return possibleChildren;
}

function MCTSSimulate(State) {
	var tempBoard = State.board.slice(0);
	var topTurn = State.turn;

	var possibleMoves = [];
	for (var i = 0; i < pits; i++)
		if (!MCTSIllegalMove(tempBoard, i + (topTurn ? 1:(2 + pits)), topTurn))
			possibleMoves[possibleMoves.length] = i + (topTurn ? 1:(2 + pits));

	return MCTSSimulateGame(tempBoard, topTurn, topTurn, possibleMoves[parseInt(Math.random() * possibleMoves.length)]);
}

function getEnd(pitLoc, seedNum, topTurn) {
	var end;
	if (topTurn) {
		end = (pitLoc + seedNum) % (2 * pits + 1);
		if (end === 0)
			return 2 * pits + 1;
		return end;
	}
	end = ((pitLoc + seedNum - pits - 1) % (2 * pits + 1) + pits + 1) % (2*pits + 2);
	if (end == pits + 1)
		return pits;
	return end;
}

function MCTSPromisingMoves(tboard, possibleMoves, topTurn) {
	var promisingMoves = [];
	var end;
	for (var i = 0; i < possibleMoves.length; i++) {
		end = getEnd(possibleMoves[i], tboard[possibleMoves[i]], topTurn);
		if (end === 0 || end == pits + 1)
			promisingMoves.push(possibleMoves[i]);
		else switch (capturingRules) {
			case "No Capturing":
				break;
			case "Always Capturing":
				if (board[end] == 1)
					promisingMoves.push(possibleMoves[i]);
				break;
			case "Opposite Occupied":
				if (board[end] == 1 && tboard[2 * pits + 2 - end] > 0)
					promisingMoves.push(possibleMoves[i]);
				break;
			case "Same Side and Opposite Occupied":
				if (((end <= pits && topTurn) || (end > pits && !topTurn)) && tboard[end] == 1 && tboard[2 * pits + 2 - end] > 0)
					promisingMoves.push(possibleMoves[i]);
				break;
		}
	}
	return promisingMoves;
}

function MCTSSimulateGame(tboard, globalTurn, topTurn, pitLoc) {
	if (!MCTSSow(tboard, pitLoc))
		topTurn = !topTurn;

	if (MCTSEndGame(tboard, topTurn) || tboard[0] > pits * seedsPerPit || tboard[pits + 1] > pits * seedsPerPit)
		return MCTSAnalyzePosition(tboard, globalTurn);

	var possibleMoves = [];
	for (var i = 0; i < pits; i++)
		if (!MCTSIllegalMove(tboard, i + (topTurn ? 1:(2 + pits)), topTurn))
			possibleMoves.push(i + (topTurn ? 1:(2 + pits)));

	var promisingMoves = MCTSPromisingMoves(tboard, possibleMoves, topTurn);

	possibleMoves = possibleMoves.concat(promisingMoves).concat(promisingMoves);

	return MCTSSimulateGame(tboard, globalTurn, topTurn, possibleMoves[Math.floor(Math.random() * possibleMoves.length)]);
}

function simulateGame(pitLoc, topTurn) {
	if (!sow(pitLoc))
		topTurn = !topTurn;

	if (endGame(topTurn))
		return analyzePosition(topTurnGlobal);

	var possibleMoves = [];
	for (var i = 0; i < pits; i++)
		if (!illegalMove(i + (topTurn ? 1:(2 + pits)), topTurn, false))
			possibleMoves[possibleMoves.length] = i + (topTurn ? 1:(2 + pits));

	return simulateGame(possibleMoves[parseInt(Math.random() * possibleMoves.length)], topTurn);
}

function monteCarloAnalyzePit(pitLoc) {
	var hits = 0;
	var misses = 0;
	var result;
	boardCopy = board.slice(0);

	for (var i = 0; i < monteCarloTrials; i++) {
		result = simulateGame(pitLoc, topTurnGlobal);
		if (result < 0)
			misses++;
		else if (result > 0)
			hits++;
		board = boardCopy.slice(0);
	}
	return hits / misses;
}

function monteCarloAnalysis() {
	var analyses = Array(pits);

	for (var i = 0; i < pits; i++) {
		if (!illegalMove(i + (topTurnGlobal ? 1:(2 + pits)), topTurnGlobal, false))
			analyses[i] = monteCarloAnalyzePit(i + (topTurnGlobal ? 1:(2 + pits)));
		else analyses[i] = -1;
	}
	return analyses;
}

function playMonteCarloAiMove() {
 getBestMoveMCTS(function(bestMove) {
	console.log(bestMove);
	playMove(bestMove);
 });
}

function drawEllipse(x, y, w, h) {
	var kappa = 0.5522848,
			ox = (w / 2) * kappa, // control point offset horizontal
			oy = (h / 2) * kappa, // control point offset vertical
			xe = x + w,					 // x-end
			ye = y + h,					 // y-end
			xm = x + w / 2,			 // x-middle
			ym = y + h / 2;			 // y-middle

	brush.moveTo(x, ym);
	brush.bezierCurveTo(x, ym - oy, xm - ox, y, xm, y);
	brush.bezierCurveTo(xm + ox, y, xe, ym - oy, xe, ym);
	brush.bezierCurveTo(xe, ym + oy, xm + ox, ye, xm, ye);
	brush.bezierCurveTo(xm - ox, ye, x, ym + oy, x, ym);
}

function clearBoard() {
	brush.clearRect(0, 0, docWidth, docHeight);
}

function getPitColor(ratio) {
	var r, g = 0, b = 0;
	r = Math.floor(ratio * 255);

	return "rgb(" + r + "," + g + "," + b + ")";
}

function drawPit(pitLoc, x, y, width, height) {
	brush.beginPath();
	drawEllipse(x, y, width, height);
	if (lastMoveGlobal < 0 || lastSowGlobal < 0);
	else if (pitLoc == lastMoveGlobal) {
		brush.fillStyle = "#76EE00"; // green
		brush.fill();
	} else if (pitLoc == lastCaptureGlobal) {
		brush.fillStyle = "#CD3333"; // light red
		brush.fill();
	} else if (pitLoc == lastSowGlobal) {
		brush.fillStyle = "#815532"; // brown
		brush.fill();
	} else if (board[lastMoveGlobal] > 0 || lastSowGlobal == lastMoveGlobal || (lastSowGlobal > lastMoveGlobal && pitLoc > lastMoveGlobal && pitLoc < lastSowGlobal) || (lastSowGlobal < lastMoveGlobal && (pitLoc > lastMoveGlobal || pitLoc < lastSowGlobal))) {
		if ((pitLoc === 0 && !topTurnGlobal) || (pitLoc == pits + 1 && topTurnGlobal));
		else {
			brush.fillStyle = "#C3834C"; // light brown
			brush.fill();
		}
	}
	if (lastRec && monteCarloAide && pitLoc == lastRec.lastMove)
		brush.strokeStyle = "blue";
	else brush.strokeStyle = "black";
	if (drawWeights && MCTSGetNextRoot(pitLoc)) {
		var tries = MCTSGetNextRoot(pitLoc).totalTries;
		var ratio = tries / globalRoot.totalTries;
		brush.lineWidth = ratio * 2 * pits;
//		 brush.strokeStyle = getPitColor(ratio);
	} else brush.lineWidth = 2;
	brush.stroke();
	brush.fillStyle = "black";
	brush.shadowBlur = 0;
}

var ovalWidth, ovalHeight;

function drawBoard() {

	clearBoard();

	var largeOvalHeight = parseInt(boardui.getAttribute("height")) - 2 * ovalHeight;
	var topText = ovalWidth / 7;
	brush.font = (ovalWidth / 3) + "px Arial";
	brush.textAlign = "center";

	// large ovals

	brush.strokeStyle = "black";

	brush.beginPath();
	drawPit(0, 1 / 4 * ovalWidth, (parseInt(boardui.getAttribute("height")) - largeOvalHeight) / 2, ovalWidth, largeOvalHeight);
	brush.fillText(board[0], 3 / 4 * ovalWidth, parseInt(boardui.getAttribute("height")) / 2 + topText);

	drawPit(pits + 1, parseInt(boardui.getAttribute("width")) - 5 / 4 * ovalWidth, (parseInt(boardui.getAttribute("height")) - largeOvalHeight) / 2, ovalWidth, largeOvalHeight);
	brush.fillText(board[pits + 1], parseInt(boardui.getAttribute("width")) - 3 / 4 * ovalWidth, parseInt(boardui.getAttribute("height")) / 2 + topText);
	brush.stroke();

	// small ovals

	for (var i = 0; i < pits; i++) {
		drawPit(reverseDrawing ? (2 * pits - i + 1):(i + 1), (i + 1.5) * ovalWidth, ovalHeight, ovalWidth, ovalHeight);
		brush.fillText(reverseDrawing ? board[2 * pits - i + 1]:board[i + 1], (i + 2) * ovalWidth, ovalHeight * 1.5 + topText);

		drawPit(reverseDrawing ? (i+1):(2 * pits - i + 1), (i + 1.5) * ovalWidth, ovalHeight * 3, ovalWidth, ovalHeight);
		brush.fillText(reverseDrawing ? board[i+1]:board[2 * pits - i + 1], (i + 2) * ovalWidth, ovalHeight * 3.5 + topText);
	}
}

function getPitLoc(x, y) {
	y -= wrapperTop;

	x = Math.floor((x - ovalWidth * 1.5) / ovalWidth);
	y = Math.floor((y - ovalHeight) / ovalHeight);

	if (x < 0 || y < 0 || x >= pits || y == 1 || y > 2)
		return -1;

	if (reverseDrawing)
		y = 2 - y;

	return x + 1 + (y > 0 ? (2 * (pits - x)):0);
}

boardui.addEventListener('mousedown', function (e) {
	if (aiTurn === topTurnGlobal) {
		alert("It is not your turn!");
		return;
	}
	var pitLoc = getPitLoc(e.pageX, e.pageY);
	if (illegalMove(pitLoc, topTurnGlobal, true))
		return;

	playMove(pitLoc);
});

function illegalMove(pitLoc, topTurn, output) {
	if (pitLoc < 0)
		return true;
	if ((topTurn && pitLoc > pits) || (!topTurn && pitLoc <= pits)) {
		if (output)
			alert("It is not your turn!");
		return true;
	}
	if (board[pitLoc] === 0) {
		if (output)
			alert("No seeds to sow");
		return true;
	}
	return false;
}

function MCTSIllegalMove(tboard, pitLoc, topTurn) {
	if (pitLoc < 0)
		return true;
	if ((topTurn && pitLoc > pits) || (!topTurn && pitLoc <= pits))
		return true;
	if (tboard[pitLoc] === 0)
		return true;
	return false;
}

function capturePit(pitLoc, topTurn) {
	var captures = board[pitLoc];
	board[pitLoc] = 0;
	if (capturingRules == "Always Capturing")
		lastCaptureGlobal = pitLoc;

	pitLoc = 2 * pits + 2 - pitLoc;
	captures += board[pitLoc];
	if (board[pitLoc] > 0)
		lastCaptureGlobal = pitLoc;
	board[pitLoc] = 0;

	if (topTurn)
		board[pits + 1] += captures;
	else board[0] += captures;
}

function MCTSCapturePit(tboard, pitLoc, topTurn) {
	var captures = tboard[pitLoc];
	tboard[pitLoc] = 0;

	pitLoc = 2 * pits + 2 - pitLoc;
	captures += tboard[pitLoc];
	tboard[pitLoc] = 0;

	if (topTurn)
		tboard[pits + 1] += captures;
	else tboard[0] += captures;
}

function sow(pitLoc) {
	lastMoveGlobal = pitLoc;
	var numSeeds = board[pitLoc];
	var topTurn = pitLoc > pits ? false:true;
	var currPit = pitLoc;
	board[pitLoc] = 0;

	for (var i = 0; i < numSeeds; i++) {
		currPit++;
		currPit = currPit % (pits * 2 + 2);
		if ((topTurn && currPit === 0) || (!topTurn && currPit == pits + 1))
			currPit++;
		board[currPit]++;
	}

	lastCaptureGlobal = -1;
	if (!(currPit === 0 || currPit == pits + 1) && capturingRules) {
		switch (capturingRules) {
			case "No Capturing":
				break;
			case "Always Capturing":
				if (board[currPit] == 1)
					capturePit(currPit, topTurn);
				break;
			case "Opposite Occupied":
				if (board[currPit] == 1 && board[2 * pits + 2 - currPit] > 0)
					capturePit(currPit, topTurn);
				break;
			case "Same Side and Opposite Occupied":
				if (((currPit <= pits && topTurn) || (currPit > pits && !topTurn)) && board[currPit] == 1 && board[2 * pits + 2 - currPit] > 0)
					capturePit(currPit, topTurn);
				break;
		}
	}

	lastSowGlobal = currPit;
	return currPit === 0 || currPit == pits + 1;
}

function MCTSSow(tboard, pitLoc) {
	var numSeeds = tboard[pitLoc];
	var topTurn = pitLoc > pits ? false:true;
	var currPit = pitLoc;
	tboard[pitLoc] = 0;

	for (var i = 0; i < numSeeds; i++) {
		currPit++;
		currPit = currPit % (pits * 2 + 2);
		if ((topTurn && currPit === 0) || (!topTurn && currPit == pits + 1))
			currPit++;
		tboard[currPit]++;
	}

	if (!(currPit === 0 || currPit == pits + 1)) {
		switch (capturingRules) {
			case "No Capturing":
				break;
			case "Always Capturing":
				if (tboard[currPit] == 1)
					MCTSCapturePit(tboard, currPit, topTurn);
				break;
			case "Opposite Occupied":
				if (tboard[currPit] == 1 && tboard[2 * pits + 2 - currPit] > 0)
					MCTSCapturePit(tboard, currPit, topTurn);
				break;
			case "Same Side and Opposite Occupied":
				if (((currPit <= pits && topTurn) || (currPit > pits && !topTurn)) && tboard[currPit] == 1 && tboard[2 * pits + 2 - currPit] > 0)
					MCTSCapturePit(tboard, currPit, topTurn);
				break;
		}
	}

	return currPit === 0 || currPit == pits + 1;
}

function endGame(topTurn) {
	var i;

	for (i = 1; i <= pits; i++)
		if ((!topTurn && board[i+pits+1] > 0) || (topTurn && board[i] > 0))
			return false;

	var captures = 0;

	for (i = 1; i <= pits; i++) {
		captures += board[i];
		board[i] = 0;
	}
	board[pits + 1] += captures;

	captures = 0;

	for (i = pits + 2; i < board.length; i++) {
		captures += board[i];
		board[i] = 0;
	}
	board[0] += captures;

	lastSowGlobal = -1;

	stopPonder();

	return true;
}

function MCTSEndGame(tboard, topTurn) {
	var i;

	for (i = 1; i <= pits; i++)
		if ((!topTurn && tboard[i+pits+1] > 0) || (topTurn && tboard[i] > 0))
			return false;

	var captures = 0;

	for (i = 1; i <= pits; i++) {
		captures += tboard[i];
		tboard[i] = 0;
	}
	tboard[pits + 1] += captures;

	captures = 0;

	for (i = pits + 2; i < tboard.length; i++) {
		captures += tboard[i];
		tboard[i] = 0;
	}
	tboard[0] += captures;

	return true;
}

document.addEventListener('keypress', function (event) {
	switch (event.which) {
		case 115: case 83: // s
			showSettingsForm();
			break;
		case 110: case 78: // n
			newGame();
			break;
	}
});

getElemId('done').addEventListener('click', function (event) {
	var settings = getNewSettings();
	gameSettings.setSettings(settings);
	hideSettingsForm();
	newGame();
});

getElemId('cancel').addEventListener('click', function (event) {
	hideSettingsForm();
	populateSettingsForm(gameSettings.getSettings());
});

if (getElemId('save'))
	getElemId('save').addEventListener('click', function (event) {
		var settings = getNewSettings();
		gameSettings.setSettings(settings);
		gameSettings.saveSettings(settings);
		hideSettingsForm();
		newGame();
	});

function getNewSettings() {
	return {
		'pits': getInputValue('num-pits'),
		'seedsPerPit': getInputValue('seeds-per-pit'),
		'ponder': getInputValue('ai-ponder'),
		'drawWeights': getInputValue('mc-weight'),
		'capturingRules': getInputValue('capture-rules'),
		'reverseDrawing': getInputValue('reverse'),
		'aiTurn': getInputValue('ai-turn'),
		'monteCarloTrials': getInputValue('mc-trials'),
		'expansionConstant': getInputValue('mc-expansion'),
		'certaintyThreshold': 1 - getInputValue('mc-certainty') / 100,
	};
}

class State {
	constructor(board, turn) {
		this.board = board;
		this.turn = turn;
	}
}

function childPotential(child, t, turn) {
	var w;
	if (child.State.turn === turn)
		w = child.hits - child.misses;
	else w = child.misses - child.hits;
	var n = child.totalTries;
	var c = expansionConstant;

	return w / n	+	c * Math.sqrt(Math.log(t) / n);
}

class MCTSNode {
	constructor(State, parent, lastMove) {
		this.State = State;
		this.parent = parent;
		this.lastMove = lastMove;
		this.hits = 0;
		this.misses = 0;
		this.totalTries = 0;
	}

	chooseChild() {
		if (!this.children)
			this.children = MCTSGetChildren(this.State, this);
		if (this.children.length === 0) // leaf node
			this.runSimulation();
		else {
			var i;
			var unexplored = [];
			for (i = 0; i < this.children.length; i++)
				if (this.children[i].totalTries === 0)
					unexplored.push(this.children[i]);

			if (unexplored.length > 0)
				unexplored[Math.floor(Math.random() * unexplored.length)].runSimulation();
			else {
				var bestChild = this.children[0], bestPotential = childPotential(this.children[0], this.totalTries, this.State.turn), potential;
				for (i = 1; i < this.children.length; i++) {
					potential = childPotential(this.children[i], this.totalTries, this.State.turn);
					if (potential > bestPotential) {
						bestPotential = potential;
						bestChild = this.children[i];
					}
				}
				bestChild.chooseChild();
			}
		}
	}

	runSimulation() {
		this.backPropogate(MCTSSimulate(this.State));
	}

	backPropogate(simulation) {
		if (simulation > 0)
			this.hits++;
		else if (simulation < 0)
			this.misses++;
		this.totalTries++;
		if (this.parent) {
			if (this.parent.State.turn === this.State.turn)
				this.parent.backPropogate(simulation);
			else this.parent.backPropogate(-simulation);
		}
	}
}
