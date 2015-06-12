
"use strict";

var exe_text;
var memory;
var emulator;
var regs = {};

var esp_pointer = '<span id="ptr-esp">esp</span>';
var ebp_pointer = ' <span id="ptr-ebp">ebp</span>';

function int_to_hexstr(n) {
  var pad = "00000000";
  return "0x" + (pad + n.toString(16)).slice(-8);
}

function byte_to_hexstr(n) {
  if (n == 0) return "00";
  if (n < 0x10) return "0" + n.toString(16);
  return n.toString(16);
}

function get_source_code() {
  return $("#source-code").val();
}

function update_registers() {
  regs = emulator.registers;
  var names = ["eax", "ebx", "ecx", "edx", "esi", "edi", "esp", "ebp", "eip"];
  for (var i=0; i<names.length; i++) {
    var name = names[i];
    $("#reg-" + name).html(int_to_hexstr(regs[name].get()));
  }
  var flags = [["flagCarry","C"], ["flagZ","Z"], ["flagSign", "S"], ["flagOv", "O"]];
  var flag_output = "";
  for (var i=0; i<flags.length; i++) {
    var original = flags[i][0];
    var display = flags[i][1];
    flag_output += "<b>" + display + "</b>:" + emulator.context[original] + " ";
  }
  $("#reg-flags").html(flag_output);
}

function memory_pointer(addr) {
  var result = "";
  var sp = regs.esp.get();
  var bp = regs.ebp.get();
  if (sp <= addr && addr < sp + 4) result += esp_pointer;
  if (bp <= addr && addr < bp + 4) result += ebp_pointer;
  if (sp + 4 <= addr && addr < bp)
    return null;
  return result;
}

function show_stack() {
  var base = 0xc0000000 - 0x80;
  var limit = 0xc0000000;
  var e = $("#mem-stack");
  e.html("");
  for (var addr = limit - 4; addr >= base; addr -= 4) {
    var value = memory.get(addr, 4);
    var head = $('<div class="mem-head"></div>').html(int_to_hexstr(addr));
    var cell = $('<div class="mem-cell"></div>').html(int_to_hexstr(value));
    var ptr = $('<div class="mem-ptr"></div>').html(memory_pointer(addr) || "&nbsp;");
    var tr = $('<div></div>');
    tr.append(head).append(cell).append(ptr);
    e.append(tr);
  }
}

function update_context() {
  update_registers();
  show_stack();
}

function assemble_error(msg, line) {
  console.log('Assemble error: ' + msg + ' in line ' + line);
}

function assemble_code() {
  var code = get_source_code();

  /* Tell Pasm about architecture. */
  code = "[bits 32]\n" + code;

  /* NASM syntax does not have "ptr" after size specifier. */
  code = code.replace("byte ptr", "byte")
             .replace("word ptr", "word")
             .replace("dword ptr", "dword")
             .replace("qword ptr", "qword");

  var result = pasm.parse(code);
  console.log(result);
  exe_text = result.data;
}

function compile_code() {
  var code = get_source_code();

  /* Dirty fix to accept negative displacement inside memory operand. */
  /* Asm86Compiler (unfortunately) uses this grammar:
   *     MemoryOperand: [ REG + REG * (2|4|8) + IMM ]
   *     IMM: -123, 0x8888, 0b110011101 ...
   * So we have to write like [ecx+-4] instead of [ecx-4] */
  var i = 0;
  var insideComment = false;
  var bracketLevel = 0;
  var revised_code = "";
  for (var i=0; i < code.length; i++) {
    var c = code.charAt(i);
    if (c == '\n') insideComment = false;
    else if (c == ';') {
      insideComment = true;
      bracketLevel = 0;
    }
    else if (c == '[') bracketLevel ++;
    else if (c == ']') bracketLevel --;
    else if (c == '-' && bracketLevel > 0 && !insideComment) {
      c = '+-';
    }
    revised_code += c;
  }

  emulator.compile(revised_code);
}

function reset_emulator() {
  compile_code();
  emulator.reset();
  update_context();
}

function step_emulator() {
  emulator.step();
  update_context();
}

function set_emulator_callbacks() {
  emulator.onCompilationError.attach(function(emulator, msg, line, lineIdx, idx) {
    console.log("compile error " + msg + " at " + line);
  });
}

$(document).ready(function() {

  window.Opcode.error = assemble_error;
  pasm.parseError = assemble_error;

  memory = new VirtualMemory();
  emulator = new Asm86Emulator(memory);
  set_emulator_callbacks();

  $("#btn-assemble").click(assemble_code);
  $("#btn-reset").click(reset_emulator);
  $("#btn-step").click(step_emulator);
});

