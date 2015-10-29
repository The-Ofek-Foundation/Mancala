var docwidth, docheight;
var pits = 6;
var seeds_per_pit = 4;
var board;
var top_turn_global;

var boardui = document.getElementById("board");
var brush = boardui.getContext("2d");

$(document).ready(function() {
  
  docwidth = $(document).outerWidth(true);
  docheight = $(document).outerHeight(true);
  
  $('#board').width(docwidth).height(docheight);
  
  boardui.setAttribute('width', docwidth);
  boardui.setAttribute('height', docheight);
  
  new_game();
});

function new_game() {
  board = new Array(pits * 2 + 2);
  for (var i = 0; i < pits * 2 + 2; i++)
    board[i] = seeds_per_pit;
  board[0] = board[pits + 1] = 0;
  top_turn_global = true;
  
  draw_board();
}

function drawEllipse(x, y, w, h) {
  var kappa = 0.5522848,
      ox = (w / 2) * kappa, // control point offset horizontal
      oy = (h / 2) * kappa, // control point offset vertical
      xe = x + w,           // x-end
      ye = y + h,           // y-end
      xm = x + w / 2,       // x-middle
      ym = y + h / 2;       // y-middle

  brush.moveTo(x, ym);
  brush.bezierCurveTo(x, ym - oy, xm - ox, y, xm, y);
  brush.bezierCurveTo(xm + ox, y, xe, ym - oy, xe, ym);
  brush.bezierCurveTo(xe, ym + oy, xm + ox, ye, xm, ye);
  brush.bezierCurveTo(xm - ox, ye, x, ym + oy, x, ym);
}

function clear_board() {
  brush.clearRect(0, 0, docwidth, docheight);
}

function draw_board() {
  
  clear_board();
  
  var oval_width = docwidth / (pits + 3);
  var oval_height = docheight / 5;
  var large_oval_height = docheight - 2 * oval_height;
  var top_text = oval_width / 7;
  brush.font = (oval_width / 3) + "px Arial";
  brush.textAlign = "center";
  
  // large ovals
  
  brush.stroketyle = "black";
  
  brush.beginPath();
  drawEllipse(1 / 4 * oval_width, (docheight - large_oval_height) / 2, oval_width, large_oval_height);
  brush.fillText(board[0], 3 / 4 * oval_width, docheight / 2 + top_text);

  drawEllipse(docwidth - 5 / 4 * oval_width, (docheight - large_oval_height) / 2, oval_width, large_oval_height);
  brush.fillText(board[pits + 1], docwidth - 3 / 4 * oval_width, docheight / 2 + top_text);
  brush.stroke();
  
  // small ovals
  brush.beginPath();
  
  for (var i = 0; i < pits; i++) {
    drawEllipse((i + 1.5) * oval_width, oval_height, oval_width, oval_height);
    brush.fillText(board[i + 1], (i + 2) * oval_width, oval_height * 1.5 + top_text);
    
    drawEllipse((i + 1.5) * oval_width, oval_height * 3, oval_width, oval_height);
    brush.fillText(board[2 * pits - i + 1], (i + 2) * oval_width, oval_height * 3.5 + top_text);
  }
  
  brush.stroketyle = "black";
  brush.stroke();
}

function get_pit_loc(x, y) {
  var oval_width = docwidth / (pits + 3);
  var oval_height = docheight / 5;
  
  
  x = Math.floor((x - oval_width * 1.5) / oval_width);
  y = Math.floor((y - oval_height) / oval_height);
  
  if (x < 0 || y < 0 || x >= pits || y == 1 || y > 2)
    return -1;
  
  return x + 1 + (y > 0 ? (2 * (pits - x)):0);
}

$(document).mousedown(function(e) {
  var pit_loc = get_pit_loc(e.pageX, e.pageY);
  if (illegal_move(pit_loc, top_turn_global, true))
    return;
  if (sow(pit_loc));
  else top_turn_global = !top_turn_global;
  
  end_game();
  draw_board();
});

function illegal_move(pit_loc, top_turn, output) {
  if (pit_loc < 0)
    return true;
  if ((top_turn && pit_loc > pits) || (!top_turn && pit_loc <= pits)) {
    if (output)
      alert("It is not your turn!");
    return true;
  }
  if (board[pit_loc] === 0) {
    if (output)
      alert("No seeds to sow");
    return true;
  }
  return false;
}

function capture_pit(pit_loc, top_turn) {
  var captures = board[pit_loc];
  board[pit_loc] = 0;
  
  pit_loc = 2 * pits + 2 - pit_loc;
  captures += board[pit_loc];
  board[pit_loc] = 0;
  
  if (top_turn)
    board[pits + 1] += captures;
  else board[0] += captures;
}

function sow(pit_loc) {
  var num_seeds = board[pit_loc];
  var top_turn = pit_loc > pits ? false:true;
  var curr_pit = pit_loc;
  board[pit_loc] = 0;
  
  for (var i = 0; i < num_seeds; i++) {
    curr_pit++;
    if ((top_turn && curr_pit === 0) || (!top_turn && curr_pit == pits + 1))
      curr_pit++;
    curr_pit = curr_pit % (pits * 2 + 2);
    board[curr_pit]++;
  }
  
  if (!(curr_pit === 0 || curr_pit == pits + 1) && board[curr_pit] == 1)
    capture_pit(curr_pit, top_turn);
  
  return curr_pit === 0 || curr_pit == pits + 1;
}

function end_game() {
  var sides = 0;
  var i;
  
  for (i = 1; i <= pits; i++)
    if (board[i] > 0) {
      sides ++;
      break;
    }
  for (i = pits + 2; i < board.length; i++)
    if (board[i] > 0) {
      sides ++;
      break;
    }
  
  if (sides != 1)
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
  
  return true;
}
