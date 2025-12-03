'use strict';

// ClangIR (CIR) dialect
// https://clang.llvm.org/docs/ClangIR.html

module.exports = {
  cir_dialect: $ => prec.right(choice(
    // cir.func - function definition with all modifiers
    seq('cir.func',
      // Pre-name modifiers
      repeat(choice(
        'no_inline', 'optnone', 'linkonce_odr', 'dso_local', 'private',
        'internal', 'external', 'weak', 'comdat', 'coroutine'
      )),
      field('name', $.symbol_ref_id),
      field('arguments', $.func_arg_list),
      field('return', optional($.func_return)),
      // Post-signature modifiers
      repeat(choice(
        seq('cc', '(', $.bare_id, ')'),
        seq('alias', '(', $.symbol_ref_id, ')'),
        'global_ctor', 'global_dtor',
        seq('global_ctor', '(', $.integer_literal, ')'),
        seq('global_dtor', '(', $.integer_literal, ')'),
        seq('special_member', '<', choice($.dialect_attribute, $.attribute_alias), '>')
      )),
      // Optional annotations array
      optional(seq('[', repeat(seq($.attribute_value, optional(','))), ']')),
      // Optional attributes block
      optional(seq('attributes', $.dictionary_attribute)),
      field('body', optional($.region))),

    // cir.call - function call (direct and indirect)
    seq('cir.call',
      choice(
        // Direct call: cir.call @func(%args)
        seq(field('callee', $.symbol_ref_id), field('operands', $._value_use_list_parens)),
        // Indirect call: cir.call %fnptr(%args)
        seq(field('fnptr', $.value_use), field('operands', $._value_use_list_parens))
      ),
      field('return', $._function_type_annotation),
      // Optional calling convention, extra attribute, side_effect
      repeat(choice(
        seq('cc', '(', $.bare_id, ')'),
        seq('extra', '(', choice($.attribute_alias, $.dialect_attribute), ')'),
        seq('side_effect', '(', $.bare_id, ')')
      ))),

    // cir.try_call - call that may throw
    seq('cir.try_call',
      choice(
        // Exception pointer form: cir.try_call exception(%ptr) @func(...)
        seq('exception', '(', $.value_use, ')', $.symbol_ref_id, $._value_use_list_parens),
        // Block destination form: cir.try_call @func(...) ^continue, ^landing
        seq($.symbol_ref_id, $._value_use_list_parens, $.caret_id, ',', $.caret_id)
      ),
      field('return', $._function_type_annotation),
      repeat(choice(
        seq('cc', '(', $.bare_id, ')'),
        seq('extra', '(', choice($.attribute_alias, $.dialect_attribute), ')')
      ))),

    // cir.return - return from function
    seq('cir.return',
      field('attributes', optional($.attribute)),
      field('results', optional($._value_use_type_list))),

    // cir.alloca - allocate stack memory (multiple forms)
    seq('cir.alloca',
      field('type', $.type), ',',
      field('addr_type', $.type),
      optional(seq(',', $.value_use, ':', $.type)),  // Optional count value
      ',',
      optional(seq('[', $.string_literal, optional(seq(',', $.bare_id)), ']')),
      field('attributes', optional($.attribute)),
      field('return', optional($._type_annotation))),

    // cir.load - load value from memory (two forms)
    seq('cir.load',
      optional(token('volatile')),
      optional(seq(token('align'), '(', $.integer_literal, ')')),
      optional(seq(token('atomic'), '(', $.bare_id, ')')),
      field('addr', $.value_use),
      field('attributes', optional($.attribute)),
      ':',
      field('ptr_type', $.type),
      optional(seq(',', field('value_type', $.type)))),

    // cir.store - store value to memory (two forms)
    seq('cir.store',
      optional(token('volatile')),
      optional(seq(token('align'), '(', $.integer_literal, ')')),
      optional(seq(token('atomic'), '(', $.bare_id, ')')),
      field('value', $.value_use), ',',
      field('addr', $.value_use),
      field('attributes', optional($.attribute)),
      ':', field('value_type', $.type),
      optional(seq(',', field('ptr_type', $.type)))),

    // cir.const - constant value
    seq('cir.const',
      field('value', choice(
        seq('(', $.attribute_value, ')'),
        $.dialect_attribute,
        $.attribute_alias)),
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    // cir.cast - type conversion
    seq('cir.cast',
      choice(
        // Parenthesized form: cir.cast(kind, %val : type), result_type
        seq('(', field('kind', $.bare_id), ',',
          field('value', $.value_use), ':',
          field('src_type', $.type), ')',
          field('attributes', optional($.attribute)),
          ',', field('return', $.type)),
        // Non-parenthesized form: cir.cast kind %val : type -> type
        seq(field('kind', $.bare_id),
          field('value', $.value_use),
          field('attributes', optional($.attribute)),
          field('return', $._function_type_annotation)))),

    // cir.binop - binary operations
    seq('cir.binop',
      '(', field('kind', $.bare_id), ',',
      field('lhs', $.value_use), ',',
      field('rhs', $.value_use), ')',
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    // cir.cmp - comparison
    seq('cir.cmp',
      '(', field('predicate', $.bare_id), ',',
      field('lhs', $.value_use), ',',
      field('rhs', $.value_use), ')',
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    // cir.unary - unary operations
    seq('cir.unary',
      '(', field('kind', $.bare_id), ',',
      field('operand', $.value_use), ')',
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    // cir.br - unconditional branch with optional arguments
    seq('cir.br',
      field('dest', $.caret_id),
      optional(seq('(', $._value_use_type_list, ')')),
      field('attributes', optional($.attribute))),

    // cir.brcond - conditional branch
    seq('cir.brcond',
      field('cond', $.value_use),
      field('true_dest', $.caret_id),
      optional($._value_arg_list), ',',
      field('false_dest', $.caret_id),
      optional($._value_arg_list),
      field('attributes', optional($.attribute))),

    // cir.yield - yield value from region
    seq('cir.yield',
      field('attributes', optional($.attribute)),
      field('results', optional($._value_use_type_list))),

    // cir.if - conditional with regions
    seq('cir.if',
      field('cond', $.value_use),
      field('then', $.region),
      optional(seq('else', field('else', $.region))),
      field('attributes', optional($.attribute)),
      field('return', optional($._type_annotation))),

    // cir.scope - lexical scope with region
    seq('cir.scope',
      field('body', $.region),
      optional(seq('cleanup', field('cleanup', $.region))),
      field('attributes', optional($.attribute)),
      field('return', optional($._type_annotation))),

    // cir.loop - loop construct (legacy form)
    seq('cir.loop',
      field('kind', $.bare_id),
      '(',
      optional(seq('cond', ':', field('cond', $.region), ',')),
      seq('body', ':', field('body', $.region)),
      optional(seq(',', 'step', ':', field('step', $.region))),
      ')',
      field('attributes', optional($.attribute)),
      field('return', optional($._type_annotation))),

    // cir.for - for loop (new form with labeled regions)
    seq('cir.for', ':',
      'cond', field('cond', $.region),
      'body', field('body', $.region),
      'step', field('step', $.region),
      field('attributes', optional($.attribute))),

    // cir.while - while loop (two forms)
    seq('cir.while',
      choice(
        // Form 1: cir.while : cond {...} body {...}
        seq(':',
          'cond', field('cond', $.region),
          'body', field('body', $.region)),
        // Form 2: cir.while {...} do {...}
        seq(field('cond', $.region),
          'do', field('body', $.region))
      ),
      field('attributes', optional($.attribute))),

    // cir.do - do-while loop (two forms)
    seq('cir.do',
      choice(
        // Form 1: cir.do : body {...} cond {...}
        seq(':',
          'body', field('body', $.region),
          'cond', field('cond', $.region)),
        // Form 2: cir.do {...} while {...}
        seq(field('body', $.region),
          'while', field('cond', $.region))
      ),
      field('attributes', optional($.attribute))),

    // cir.condition - loop/switch condition
    seq('cir.condition', '(', field('cond', $.value_use), ')',
      field('attributes', optional($.attribute))),

    // cir.await - coroutine await
    seq('cir.await', '(', field('kind', $.bare_id), ',',
      'ready', ':', field('ready', $.region), ',',
      'suspend', ':', field('suspend', $.region), ',',
      'resume', ':', field('resume', $.region), ',', ')',
      field('attributes', optional($.attribute))),

    // cir.global - global variable with all modifiers
    seq('cir.global',
      // Visibility: quoted string or bare identifier
      optional($.string_literal),
      // Linkage and other modifiers
      repeat(choice(
        'external', 'internal', 'private', 'constant', 'weak', 'comdat',
        // TLS models
        'tls_dyn', 'tls_local_dyn', 'tls_init_exec', 'tls_local_exec',
        // Address spaces
        seq('lang_address_space', '(', $.bare_id, ')'),
        seq('target_address_space', '(', $.integer_literal, ')')
      )),
      field('name', $.symbol_ref_id),
      // Optional initializer
      optional(seq('=',
        choice(
          // Ctor/dtor form
          seq(choice('ctor', 'dtor'), ':', $.type, $.region,
            optional(seq('dtor', $.region))),
          // Attribute initializer
          choice($.dialect_attribute, $.attribute_alias)
        )
      )),
      field('return', optional($._type_annotation)),
      // Optional trailing annotations
      optional(seq('[', repeat(seq($.attribute_value, optional(','))), ']')),
      // Optional trailing attribute dict
      field('attributes', optional($.attribute))),

    // cir.get_global - get address of global
    seq('cir.get_global',
      optional(token('thread_local')),
      field('name', $.symbol_ref_id),
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    // cir.ptr_stride - pointer arithmetic (two forms)
    seq('cir.ptr_stride',
      choice(
        // Parenthesized form
        seq('(', field('base', $.value_use), ':',
          field('base_type', $.type), ',',
          field('stride', $.value_use), ':',
          field('stride_type', $.type), ')',
          field('attributes', optional($.attribute)),
          ',', field('return', $.type)),
        // Non-parenthesized form
        seq(field('base', $.value_use), ',', field('stride', $.value_use),
          field('return', $._function_type_annotation)))),

    // cir.try - exception handling with catch clauses
    seq('cir.try',
      field('body', $.region),
      optional(seq('catch', '[',
        repeat(seq(
          choice(
            seq('type', choice($.dialect_attribute, $.attribute_alias), $.region),
            seq($.dialect_attribute, $.region)
          ),
          optional(',')
        )),
        ']')),
      optional(seq('cleanup', field('cleanup', $.region))),
      field('attributes', optional($.attribute))),

    // cir.throw - throw exception
    seq('cir.throw',
      optional(field('exception', $.value_use)),
      field('attributes', optional($.attribute)),
      field('return', optional($._type_annotation))),

    // cir.catch_param - catch exception parameter
    seq('cir.catch_param',
      optional($.value_use),
      field('return', $._function_return)),

    // cir.resume - resume exception propagation
    seq('cir.resume', field('attributes', optional($.attribute))),

    // cir.struct_element_addr - get address of struct field
    seq('cir.struct_element_addr',
      field('base', $.value_use), ',',
      field('index', $.integer_literal),
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    // cir.get_member - get struct member
    seq('cir.get_member',
      field('base', $.value_use),
      '[', field('index', $.integer_literal), ']',
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    // cir.switch - switch statement with region
    seq('cir.switch',
      '(', field('cond', $.value_use), ':', field('cond_type', $.type), ')',
      field('body', $.region),
      field('attributes', optional($.attribute))),

    // cir.case - case in switch
    seq('cir.case', '(',
      field('kind', $.bare_id), ',',
      '[', optional(repeat(seq($.attribute_value, optional(',')))), ']',
      ')',
      field('body', $.region)),

    // cir.ternary - ternary conditional operator (two forms)
    seq('cir.ternary',
      '(', field('cond', $.value_use), ',',
      token('true'), field('true_region', $.region), ',',
      token('false'), field('false_region', $.region), ')',
      field('attributes', optional($.attribute)),
      field('return', $._function_type_annotation)),

    // cir.select - select value based on condition
    seq('cir.select',
      field('cond', $.value_use), ',',
      field('true_val', $.value_use), ',',
      field('false_val', $.value_use),
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    // cir.copy - copy memory (two forms)
    seq('cir.copy',
      choice(
        // Form with 'to': cir.copy %src to %dst : type
        seq(field('src', $.value_use), 'to', field('dst', $.value_use),
          field('return', $._type_annotation)),
        // Form with comma: cir.copy %dst, %src
        seq(field('dst', $.value_use), ',', field('src', $.value_use),
          field('attributes', optional($.attribute)),
          field('return', optional($._type_annotation))))),

    // cir.break - break from loop/switch
    seq('cir.break', field('attributes', optional($.attribute))),

    // cir.continue - continue to next loop iteration
    seq('cir.continue', field('attributes', optional($.attribute))),

    // cir.unreachable - marks unreachable code
    seq('cir.unreachable', field('attributes', optional($.attribute))),

    // cir.trap - abort execution
    seq('cir.trap', field('attributes', optional($.attribute))),

    // cir.objsize - get object size
    seq('cir.objsize',
      field('kind', $.bare_id),
      field('value', $.value_use),
      field('attributes', optional($.attribute)),
      field('return', $._function_type_annotation)),

    // cir.shift - bit shift operation
    seq('cir.shift',
      '(', field('direction', $.bare_id), ',',
      field('lhs', $.value_use), ':',
      field('lhs_type', $.type), ',',
      field('rhs', $.value_use), ':',
      field('rhs_type', $.type), ')',
      field('attributes', optional($.attribute)),
      field('return', $._function_return)),

    // Bit manipulation operations
    seq(choice('cir.clrsb', 'cir.ffs', 'cir.parity'),
      field('value', $.value_use),
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    seq(choice('cir.clz', 'cir.ctz', 'cir.popcount'),
      field('value', $.value_use),
      optional(token('zero_poison')),
      field('attributes', optional($.attribute)),
      field('return', $._type_annotation)),

    // cir.dyn_cast - dynamic cast
    seq('cir.dyn_cast',
      choice('ptr', 'ref'),
      optional(token('relative_layout')),
      field('value', $.value_use),
      field('return', $._function_type_annotation),
      optional(choice($.attribute_alias, $.dialect_attribute))),

    // cir.blockaddress - get address of a block
    seq('cir.blockaddress',
      '<', $.symbol_ref_id, ',', $.string_literal, '>',
      field('return', $._function_return)),

    // cir.indirectbr - indirect branch
    seq('cir.indirectbr',
      field('addr', $.value_use),
      ':', '<', $.type, '>', ',',
      '[', repeat(seq($.caret_id, optional(','))), ']',
      field('attributes', optional($.attribute))),

    // cir.label - label marker
    seq('cir.label', $.string_literal, field('attributes', optional($.attribute))),

    // cir.libc.memcpy - libc memcpy
    seq('cir.libc.memcpy',
      field('len', $.value_use), 'bytes', 'from',
      field('src', $.value_use), 'to',
      field('dst', $.value_use),
      field('return', $._function_type_annotation)),

    // cir.libc.memchr - libc memchr (two forms)
    seq('cir.libc.memchr',
      choice(
        // Parenthesized form: cir.libc.memchr(%src, %pattern, %len)
        seq('(', field('src', $.value_use), ',',
          field('char', $.value_use), ',',
          field('len', $.value_use), ')'),
        // Comma-separated form
        seq(field('src', $.value_use), ',',
          field('char', $.value_use), ',',
          field('len', $.value_use),
          field('return', $._function_type_annotation))
      )),

    // cir.libc.fabs - libc fabs
    seq('cir.libc.fabs',
      field('value', $.value_use),
      field('return', $._type_annotation)),

    // cir.stack_save - save current stack pointer
    seq('cir.stack_save',
      field('return', $._type_annotation)),

    // cir.stack_restore - restore stack pointer
    seq('cir.stack_restore',
      field('value', $.value_use),
      field('return', $._type_annotation)),

    // cir.get_runtime_member - get struct member at runtime
    seq('cir.get_runtime_member',
      field('base', $.value_use),
      '[', field('member', $.value_use), ':', field('member_type', $.type), ']',
      field('return', $._function_type_annotation))
  ))
}
