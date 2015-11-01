var docwidth, docheight;
var pits = 6;
var seeds_per_pit = 4;
var board, board_copy;
var top_turn_global;
var monte_carlo_trials = 100000;
var ai = -1;
var capturing_rules = "Same Side and Opposite Occupied";
var reverse_drawing = true;
var last_capture_global, last_move_global, last_sow_global;
var global_ROOT;
var expansion_const = 2;
var board_saves = [];

var boardui = document.getElementById("board");
var brush = boardui.getContext("2d");

$(document).ready(function() {
  
  docwidth = $(document).outerWidth(true);
  docheight = $(document).outerHeight(true);
  
  $('#board').width(docwidth).height(docheight);
  
  boardui.setAttribute('width', docwidth);
  boardui.setAttribute('height', docheight);
  
  new_game();
  
  alert("Press 'n' for a new game!");
});

function new_game() {
  global_ROOT = null;
  board = new Array(pits * 2 + 2);
  for (var i = 0; i < pits * 2 + 2; i++)
    board[i] = seeds_per_pit;
  board[0] = board[pits + 1] = 0;
  top_turn_global = true;
  last_sow_global = last_capture_global = last_move_global = -1;
  
  draw_board();
  
  if (ai == top_turn_global)
    setTimeout(play_monte_carlo_ai_move, 30);
}

function create_MCTS_root() {
  return new MCTS_Node(new State(board, top_turn_global), null, null, MCTS_simulate, MCTS_get_children, expansion_const);
}

function MCTS_get_next_root(pit_loc) {
  if (!global_ROOT || !global_ROOT.children)
    return null;
  for (var i = 0; i < global_ROOT.children.length; i++)
    if (global_ROOT.children[i].last_move == pit_loc) {
      global_ROOT.children[i].parent = null;
      return global_ROOT.children[i];
    }
  return null;
}

function run_MCTS(times) {
  if (!global_ROOT)
    global_ROOT = create_MCTS_root();
  for (var i = 0; i < times; i++)
    global_ROOT.choose_child();
  return global_ROOT;
}

function get_best_move_MCTS() {
  run_MCTS(monte_carlo_trials);
  var best_move, most_trials = 0;
  for (var i = 0; i < global_ROOT.children.length; i++)
    if (global_ROOT.children[i].total_tries > most_trials) {
      most_trials = global_ROOT.children[i].total_tries;
      best_move = global_ROOT.children[i].last_move;
    }
  return best_move;
}

function analyze_position(top_turn) {
  return (top_turn ? (board[pits + 1] - board[0]):(board[0] - board[pits + 1]));
}

function MCTS_analyze_position(tboard, top_turn) {
  return (top_turn ? (tboard[pits + 1] - tboard[0]):(tboard[0] - tboard[pits + 1]));
}

function MCTS_get_children(state, father) {
  var temp_board = state.board.slice(0);
  var top_turn = state.turn;
  var i;
  
  var possible_moves = [];
  for (i = 0; i < pits; i++)
    if (!MCTS_illegal_move(temp_board, i + (top_turn ? 1:(2 + pits)), top_turn))
      possible_moves[possible_moves.length] = i + (top_turn ? 1:(2 + pits));
  
  var possible_children = new Array(possible_moves.length);
  
  for (i = 0; i < possible_children.length; i++) {
    if (!MCTS_sow(temp_board, possible_moves[i]))
      top_turn = !top_turn;
    MCTS_end_game(temp_board);
    possible_children[i] = new MCTS_Node(new State(temp_board, top_turn), father, possible_moves[i], MCTS_simulate, MCTS_get_children, expansion_const);
    
    temp_board = state.board.slice(0);
    top_turn = state.turn;
  }
  
  return possible_children;
}

function MCTS_simulate(State) {
  var temp_board = State.board.slice(0);
  var top_turn = State.turn;
  
  var possible_moves = [];
  for (var i = 0; i < pits; i++)
    if (!MCTS_illegal_move(temp_board, i + (top_turn ? 1:(2 + pits)), top_turn))
      possible_moves[possible_moves.length] = i + (top_turn ? 1:(2 + pits));
  
  return MCTS_simulate_game(temp_board, top_turn, top_turn, possible_moves[parseInt(Math.random() * possible_moves.length)]);
}

function MCTS_promising_moves(tboard, possible_moves, top_turn) {
  var promising_moves = [];
  var end;
  for (var i = 0; i < possible_moves.length; i++) {
    end = (possible_moves[i] + tboard[possible_moves[i]]) % (pits * 2 + 2);
    if (end === 0 || end == pits + 1)
      promising_moves.push(possible_moves[i]);
    else switch (capturing_rules) {
      case "No Capturing":
        break;
      case "Always Capturing":
        if (board[end] == 1)
          promising_moves.push(possible_moves[i]);
        break;
      case "Opposite Occupied":
        if (board[end] == 1 && tboard[2 * pits + 2 - end] > 0)
          promising_moves.push(possible_moves[i]);
        break;
      case "Same Side and Opposite Occupied":
        if (((end <= pits && top_turn) || (end > pits && !top_turn)) && tboard[end] == 1 && tboard[2 * pits + 2 - end] > 0)
          promising_moves.push(possible_moves[i]);
        break;
    }
  }
  return promising_moves;
}

function MCTS_simulate_game(tboard, global_turn, top_turn, pit_loc) {
  if (!MCTS_sow(tboard, pit_loc))
    top_turn = !top_turn;
  
  if (MCTS_end_game(tboard) || tboard[0] > pits * seeds_per_pit || tboard[pits + 1] > pits * seeds_per_pit)
    return MCTS_analyze_position(tboard, global_turn);
    
  var possible_moves = [];
  for (var i = 0; i < pits; i++)
    if (!MCTS_illegal_move(tboard, i + (top_turn ? 1:(2 + pits)), top_turn))
      possible_moves.push(i + (top_turn ? 1:(2 + pits)));
  
  var promising_moves = MCTS_promising_moves(tboard, possible_moves, top_turn);
  
  possible_moves = possible_moves.concat(promising_moves);
  
  return MCTS_simulate_game(tboard, global_turn, top_turn, possible_moves[Math.floor(Math.random() * possible_moves.length)]);
}

function simulate_game(pit_loc, top_turn) {
  if (!sow(pit_loc))
    top_turn = !top_turn;
  
  if (end_game())
    return analyze_position(top_turn_global);
  
  var possible_moves = [];
  for (var i = 0; i < pits; i++)
    if (!illegal_move(i + (top_turn ? 1:(2 + pits)), top_turn, false))
      possible_moves[possible_moves.length] = i + (top_turn ? 1:(2 + pits));
  
  return simulate_game(possible_moves[parseInt(Math.random() * possible_moves.length)], top_turn);
}

function monte_carlo_analyze_pit(pit_loc) {
  var hits = 0;
  var misses = 0;
  var result;
  board_copy = board.slice(0);
  
  for (var i = 0; i < monte_carlo_trials; i++) {
    result = simulate_game(pit_loc, top_turn_global);
    if (result < 0)
      misses++;
    else if (result > 0)
      hits++;
    board = board_copy.slice(0);
  }
  return hits / misses;
}

function monte_carlo_analysis() {
  var analyses = Array(pits);
  
  for (var i = 0; i < pits; i++) {
    if (!illegal_move(i + (top_turn_global ? 1:(2 + pits)), top_turn_global, false))
      analyses[i] = monte_carlo_analyze_pit(i + (top_turn_global ? 1:(2 + pits)));
    else analyses[i] = -1;
  }
  return analyses;
}

function play_monte_carlo_ai_move() {
//   var analysis = monte_carlo_analysis();
//   var best_move = -1;
//   var best_score = -1;
//   for (var i = 0; i < analysis.length; i++)
//     if (analysis[i] > best_score) {
//       best_score = analysis[i];
//       best_move = i + (top_turn_global ? 1:(2 + pits));
//     }
    
  var best_move = get_best_move_MCTS();
  
  global_ROOT = MCTS_get_next_root(best_move);
  
  console.log(best_move);
  
  var again = false;
    
  if(sow(best_move))
    again = true;
  else top_turn_global = !top_turn_global;
  
  end_game();
  
  draw_board();
  
  if (again) {
    setTimeout(play_monte_carlo_ai_move, 10);
  }
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

function draw_pit(pit_loc, x, y, width, height) {
  brush.beginPath();
  drawEllipse(x, y, width, height);
  if (last_move_global < 0 || last_sow_global < 0);
  else if (pit_loc == last_move_global) {
    brush.fillStyle = "#76EE00"; // green
    brush.fill();
  }
  else if (pit_loc == last_capture_global) {
    brush.fillStyle = "#CD3333"; // light red
    brush.fill();
  }
  else if (pit_loc == last_sow_global) {
    brush.fillStyle = "#614126"; // brown
    brush.fill();
  }
  else if (board[last_move_global] > 0 || last_sow_global == last_move_global || (last_sow_global > last_move_global && pit_loc > last_move_global && pit_loc < last_sow_global) || (last_sow_global < last_move_global && (pit_loc > last_move_global || pit_loc < last_sow_global))) {
    if ((pit_loc === 0 && !top_turn_global) || (pit_loc == pits + 1 && top_turn_global));
    else {
      brush.fillStyle = "#C3834C"; // light brown
      brush.fill();
    }
  }
  brush.strokeStyle = "black";
  brush.stroke();
  brush.fillStyle = "black";
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
  draw_pit(0, 1 / 4 * oval_width, (docheight - large_oval_height) / 2, oval_width, large_oval_height);
  brush.fillText(board[0], 3 / 4 * oval_width, docheight / 2 + top_text);

  draw_pit(pits + 1, docwidth - 5 / 4 * oval_width, (docheight - large_oval_height) / 2, oval_width, large_oval_height);
  brush.fillText(board[pits + 1], docwidth - 3 / 4 * oval_width, docheight / 2 + top_text);
  brush.stroke();
  
  // small ovals
  
  for (var i = 0; i < pits; i++) {
    draw_pit(reverse_drawing ? (2 * pits - i + 1):(i + 1), (i + 1.5) * oval_width, oval_height, oval_width, oval_height);
    brush.fillText(reverse_drawing ? board[2 * pits - i + 1]:board[i + 1], (i + 2) * oval_width, oval_height * 1.5 + top_text);
    
    draw_pit(reverse_drawing ? (i+1):(2 * pits - i + 1), (i + 1.5) * oval_width, oval_height * 3, oval_width, oval_height);
    brush.fillText(reverse_drawing ? board[i+1]:board[2 * pits - i + 1], (i + 2) * oval_width, oval_height * 3.5 + top_text);
  }
}

function get_pit_loc(x, y) {
  var oval_width = docwidth / (pits + 3);
  var oval_height = docheight / 5;
  
  x = Math.floor((x - oval_width * 1.5) / oval_width);
  y = Math.floor((y - oval_height) / oval_height);
  
  if (x < 0 || y < 0 || x >= pits || y == 1 || y > 2)
    return -1;
  
  if (reverse_drawing)
    y = 2 - y;
  
  return x + 1 + (y > 0 ? (2 * (pits - x)):0);
}

$('#board').mousedown(function(e) {
  var pit_loc = get_pit_loc(e.pageX, e.pageY);
  if (illegal_move(pit_loc, top_turn_global, true))
    return;
  if (sow(pit_loc));
  else top_turn_global = !top_turn_global;
  
  global_ROOT = MCTS_get_next_root(pit_loc);
  
  end_game();
  
  draw_board();
  if (ai == top_turn_global) {
    setTimeout(play_monte_carlo_ai_move, 10);
  }
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

function MCTS_illegal_move(tboard, pit_loc, top_turn) {
  if (pit_loc < 0)
    return true;
  if ((top_turn && pit_loc > pits) || (!top_turn && pit_loc <= pits))
    return true;
  if (tboard[pit_loc] === 0)
    return true;
  return false;
}

function capture_pit(pit_loc, top_turn) {
  var captures = board[pit_loc];
  board[pit_loc] = 0;
  if (capturing_rules == "Always Capturing")
    last_capture_global = pit_loc;
  
  pit_loc = 2 * pits + 2 - pit_loc;
  captures += board[pit_loc];
  if (board[pit_loc] > 0)
    last_capture_global = pit_loc;
  board[pit_loc] = 0;
  
  if (top_turn)
    board[pits + 1] += captures;
  else board[0] += captures;
}

function MCTS_capture_pit(tboard, pit_loc, top_turn) {
  var captures = tboard[pit_loc];
  tboard[pit_loc] = 0;
  
  pit_loc = 2 * pits + 2 - pit_loc;
  captures += tboard[pit_loc];
  tboard[pit_loc] = 0;
  
  if (top_turn)
    tboard[pits + 1] += captures;
  else tboard[0] += captures;
}

function sow(pit_loc) {
  last_move_global = pit_loc;
  var num_seeds = board[pit_loc];
  var top_turn = pit_loc > pits ? false:true;
  var curr_pit = pit_loc;
  board[pit_loc] = 0;
  
  for (var i = 0; i < num_seeds; i++) {
    curr_pit++;
    curr_pit = curr_pit % (pits * 2 + 2);
    if ((top_turn && curr_pit === 0) || (!top_turn && curr_pit == pits + 1))
      curr_pit++;
    board[curr_pit]++;
  }
  
  last_capture_global = -1;
  if (!(curr_pit === 0 || curr_pit == pits + 1) && capturing_rules) {
    switch (capturing_rules) {
      case "No Capturing":
        break;
      case "Always Capturing":
        if (board[curr_pit] == 1)
          capture_pit(curr_pit, top_turn);
        break;
      case "Opposite Occupied":
        if (board[curr_pit] == 1 && board[2 * pits + 2 - curr_pit] > 0)
          capture_pit(curr_pit, top_turn);
        break;
      case "Same Side and Opposite Occupied":
        if (((curr_pit <= pits && top_turn) || (curr_pit > pits && !top_turn)) && board[curr_pit] == 1 && board[2 * pits + 2 - curr_pit] > 0)
          capture_pit(curr_pit, top_turn);
        break;
    }
  }
  
  last_sow_global = curr_pit;
  return curr_pit === 0 || curr_pit == pits + 1;
}

function MCTS_sow(tboard, pit_loc) {
  var num_seeds = tboard[pit_loc];
  var top_turn = pit_loc > pits ? false:true;
  var curr_pit = pit_loc;
  tboard[pit_loc] = 0;
  
  for (var i = 0; i < num_seeds; i++) {
    curr_pit++;
    curr_pit = curr_pit % (pits * 2 + 2);
    if ((top_turn && curr_pit === 0) || (!top_turn && curr_pit == pits + 1))
      curr_pit++;
    tboard[curr_pit]++;
  }
  
  if (!(curr_pit === 0 || curr_pit == pits + 1)) {
    switch (capturing_rules) {
      case "No Capturing":
        break;
      case "Always Capturing":
        if (tboard[curr_pit] == 1)
          MCTS_capture_pit(tboard, curr_pit, top_turn);
        break;
      case "Opposite Occupied":
        if (tboard[curr_pit] == 1 && tboard[2 * pits + 2 - curr_pit] > 0)
          MCTS_capture_pit(tboard, curr_pit, top_turn);
        break;
      case "Same Side and Opposite Occupied":
        if (((curr_pit <= pits && top_turn) || (curr_pit > pits && !top_turn)) && tboard[curr_pit] == 1 && tboard[2 * pits + 2 - curr_pit] > 0)
          MCTS_capture_pit(tboard, curr_pit, top_turn);
        break;
    }
  }
  
  return curr_pit === 0 || curr_pit == pits + 1;
}

function end_game() {
  var sides = 0;
  var i;
  
  for (i = 1; i <= pits; i++)
    if (board[i] > 0) {
      sides++;
      break;
    }
  for (i = pits + 2; i < board.length; i++)
    if (board[i] > 0) {
      sides++;
      break;
    }
  
  if (sides == 2)
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
  
  last_sow_global = -1;
  
  return true;
}

function MCTS_end_game(tboard) {
  var sides = 0;
  var i;
  
  for (i = 1; i <= pits; i++)
    if (tboard[i] > 0) {
      sides++;
      break;
    }
  for (i = pits + 2; i < tboard.length; i++)
    if (tboard[i] > 0) {
      sides++;
      break;
    }
  
  if (sides == 2)
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

$(document).keydown(function(e) {
//   alert(e.which);
  switch (e.which) {
    case 78: // n
      $('#new-game-menu').animate({opacity: 0.9}, "slow").css('z-index', 1);
      break;
  }
});

var dont_submit;

$('#form-new-game').submit(function() {
  if (dont_submit) {
    dont_submit = false;
    return false;
  }
  
  pits = parseInt($('input[name="num-pits"]').val());
  seeds_per_pit = parseInt($('input[name="seeds-per-pit"]').val());
  
  var ai_playing = $('input[name="ai"]').prop('checked');
  capturing_rules = $('input[name="capture-rules"]').val();
  reverse_drawing = $('input[name="reverse"]').prop('checked');
  ai = $('input[name="ai-turn"]').val() == "First" ? true:false;
  if (!ai_playing)
    ai = -1;
  monte_carlo_trials = $('input[name="mc-trials"]').val();
  expansion_const = $('input[name="mc-expansion"]').val();
  
  $('#new-game-menu').animate({opacity: 0}, "slow", function() {
    $(this).css('z-index', -1);
    new_game();
  });
  
  return false;
});

$('#btn-new-game-cancel').click(function() {
  dont_submit = true;
  $('#new-game-menu').animate({opacity: 0}, "slow", function() {
    $(this).css('z-index', -1);
  });
});
