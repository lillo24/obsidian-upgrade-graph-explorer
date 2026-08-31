import { formatGraphQuery } from './format';
import {
  MAX_GRAPH_QUERY_AST_NODES,
  MAX_GRAPH_QUERY_LENGTH,
  MAX_GRAPH_QUERY_NESTING,
  type GraphQueryExpression,
  type GraphQueryIssue,
  type GraphQueryLevelOperator,
  type GraphQueryParseResult,
  type GraphQuerySectionLevel,
  type GraphQueryStringField,
} from './types';

type TokenKind =
  | 'word'
  | 'string'
  | 'colon'
  | 'equals'
  | 'lte'
  | 'gte'
  | 'left-parenthesis'
  | 'right-parenthesis'
  | 'comma'
  | 'end';

interface Token {
  readonly kind: TokenKind;
  readonly value: string;
  readonly start: number;
  readonly end: number;
}

interface Tokenization {
  readonly tokens: readonly Token[];
  readonly issues: readonly GraphQueryIssue[];
}

function issue(
  code: GraphQueryIssue['code'],
  position: number,
  length: number,
  message: string,
): GraphQueryIssue {
  return { code, position, length, message };
}

function tokenize(query: string): Tokenization {
  const tokens: Token[] = [];
  const issues: GraphQueryIssue[] = [];
  let cursor = 0;
  while (cursor < query.length) {
    const character = query[cursor];
    if (character === undefined) break;
    if (/\s/u.test(character)) {
      cursor += 1;
      continue;
    }
    const start = cursor;
    if (
      character === '(' ||
      character === ')' ||
      character === ':' ||
      character === '=' ||
      character === ','
    ) {
      const kinds: Record<string, TokenKind> = {
        '(': 'left-parenthesis',
        ')': 'right-parenthesis',
        ':': 'colon',
        '=': 'equals',
        ',': 'comma',
      };
      tokens.push({
        kind: kinds[character] ?? 'word',
        value: character,
        start,
        end: ++cursor,
      });
      continue;
    }
    if ((character === '<' || character === '>') && query[cursor + 1] === '=') {
      cursor += 2;
      tokens.push({
        kind: character === '<' ? 'lte' : 'gte',
        value: `${character}=`,
        start,
        end: cursor,
      });
      continue;
    }
    if (character === '<' || character === '>') {
      cursor += 1;
      tokens.push({ kind: 'word', value: character, start, end: cursor });
      continue;
    }
    if (character === '"') {
      cursor += 1;
      let value = '';
      let terminated = false;
      while (cursor < query.length) {
        const current = query[cursor];
        if (current === '"') {
          cursor += 1;
          terminated = true;
          break;
        }
        if (current === '\\') {
          const escaped = query[cursor + 1];
          if (escaped !== '"' && escaped !== '\\') {
            issues.push(
              issue(
                'invalid-escape',
                cursor,
                Math.min(2, query.length - cursor),
                'Quoted values support only \\" and \\\\ escapes.',
              ),
            );
            return { tokens, issues };
          }
          value += escaped;
          cursor += 2;
          continue;
        }
        value += current;
        cursor += 1;
      }
      if (!terminated) {
        issues.push(
          issue(
            'unterminated-string',
            start,
            query.length - start,
            'Quoted value is missing its closing quote.',
          ),
        );
        return { tokens, issues };
      }
      tokens.push({ kind: 'string', value, start, end: cursor });
      continue;
    }
    while (cursor < query.length) {
      const current = query[cursor];
      if (current === undefined || /[\s():=,<>"]/u.test(current)) break;
      cursor += 1;
    }
    tokens.push({
      kind: 'word',
      value: query.slice(start, cursor),
      start,
      end: cursor,
    });
  }
  tokens.push({
    kind: 'end',
    value: '',
    start: query.length,
    end: query.length,
  });
  return { tokens, issues };
}

class Parser {
  private cursor = 0;
  private nodeCount = 0;
  private nesting = 0;
  readonly issues: GraphQueryIssue[] = [];

  constructor(private readonly tokens: readonly Token[]) {}

  private current(): Token {
    return (
      this.tokens[this.cursor] ?? {
        kind: 'end',
        value: '',
        start: 0,
        end: 0,
      }
    );
  }

  private advance(): Token {
    const current = this.current();
    if (current.kind !== 'end') this.cursor += 1;
    return current;
  }

  private addNode(
    expression: GraphQueryExpression,
  ): GraphQueryExpression | undefined {
    this.nodeCount += 1;
    if (this.nodeCount > MAX_GRAPH_QUERY_AST_NODES) {
      const token = this.current();
      this.issues.push(
        issue(
          'query-too-complex',
          token.start,
          Math.max(1, token.end - token.start),
          `A query may contain at most ${MAX_GRAPH_QUERY_AST_NODES} expression nodes.`,
        ),
      );
      return undefined;
    }
    return expression;
  }

  private keyword(value: string): boolean {
    const token = this.current();
    return token.kind === 'word' && token.value.toLowerCase() === value;
  }

  parse(): GraphQueryExpression | undefined {
    const expression = this.parseOr();
    if (expression === undefined || this.issues.length > 0) return undefined;
    const remaining = this.current();
    if (remaining.kind === 'comma') {
      this.issues.push(
        issue(
          'unsupported-comma',
          remaining.start,
          1,
          'Commas are not Boolean operators. Use OR between alternatives.',
        ),
      );
    } else if (remaining.kind !== 'end') {
      const isOperand =
        remaining.kind === 'word' ||
        remaining.kind === 'string' ||
        remaining.kind === 'left-parenthesis';
      this.issues.push(
        issue(
          isOperand ? 'missing-operator' : 'unexpected-token',
          remaining.start,
          Math.max(1, remaining.end - remaining.start),
          isOperand
            ? 'Predicates must be joined with explicit AND or OR.'
            : `Unexpected token "${remaining.value}".`,
        ),
      );
    }
    return this.issues.length === 0 ? expression : undefined;
  }

  private parseOr(): GraphQueryExpression | undefined {
    let left = this.parseAnd();
    while (left !== undefined && this.keyword('or')) {
      this.advance();
      const right = this.parseAnd();
      if (right === undefined) return undefined;
      left = this.addNode({ kind: 'or', left, right });
    }
    return left;
  }

  private parseAnd(): GraphQueryExpression | undefined {
    let left = this.parseNot();
    while (left !== undefined && this.keyword('and')) {
      this.advance();
      const right = this.parseNot();
      if (right === undefined) return undefined;
      left = this.addNode({ kind: 'and', left, right });
    }
    return left;
  }

  private parseNot(): GraphQueryExpression | undefined {
    if (!this.keyword('not')) return this.parsePrimary();
    const token = this.advance();
    this.nesting += 1;
    if (this.nesting > MAX_GRAPH_QUERY_NESTING) {
      this.issues.push(
        issue(
          'query-too-deep',
          token.start,
          token.end - token.start,
          `A query may nest at most ${MAX_GRAPH_QUERY_NESTING} levels.`,
        ),
      );
      return undefined;
    }
    const expression = this.parseNot();
    this.nesting -= 1;
    return expression === undefined
      ? undefined
      : this.addNode({ kind: 'not', expression });
  }

  private parsePrimary(): GraphQueryExpression | undefined {
    const token = this.current();
    if (token.kind === 'left-parenthesis') {
      this.advance();
      this.nesting += 1;
      if (this.nesting > MAX_GRAPH_QUERY_NESTING) {
        this.issues.push(
          issue(
            'query-too-deep',
            token.start,
            1,
            `A query may nest at most ${MAX_GRAPH_QUERY_NESTING} levels.`,
          ),
        );
        return undefined;
      }
      const expression = this.parseOr();
      this.nesting -= 1;
      if (expression === undefined) return undefined;
      const closing = this.current();
      if (closing.kind !== 'right-parenthesis') {
        this.issues.push(
          issue(
            'unexpected-token',
            closing.start,
            Math.max(1, closing.end - closing.start),
            'Expected a closing parenthesis.',
          ),
        );
        return undefined;
      }
      this.advance();
      return expression;
    }
    if (token.kind === 'comma') {
      this.issues.push(
        issue(
          'unsupported-comma',
          token.start,
          1,
          'Commas are not Boolean operators. Use OR between alternatives.',
        ),
      );
      return undefined;
    }
    if (token.kind !== 'word') {
      this.issues.push(
        issue(
          'unexpected-token',
          token.start,
          Math.max(1, token.end - token.start),
          token.kind === 'end'
            ? 'Expected a predicate.'
            : `Unexpected token "${token.value}".`,
        ),
      );
      return undefined;
    }
    return this.parsePredicate();
  }

  private parsePredicate(): GraphQueryExpression | undefined {
    const nameToken = this.advance();
    const name = nameToken.value.toLowerCase();
    const shorthand: Readonly<
      Record<string, 'document' | 'section' | 'block'>
    > = {
      file: 'document',
      files: 'document',
      document: 'document',
      documents: 'document',
      section: 'section',
      sections: 'section',
      block: 'block',
      blocks: 'block',
    };
    const shorthandKind = shorthand[name];
    if (shorthandKind !== undefined)
      return this.addNode({ kind: 'kind-predicate', value: shorthandKind });

    if (
      name === 'path' ||
      name === 'title' ||
      name === 'text' ||
      name === 'kind'
    ) {
      const separator = this.current();
      if (separator.kind !== 'colon') {
        this.issues.push(
          issue(
            'unexpected-token',
            separator.start,
            Math.max(1, separator.end - separator.start),
            `Expected : after ${name}.`,
          ),
        );
        return undefined;
      }
      this.advance();
      const valueToken = this.current();
      if (valueToken.kind !== 'word' && valueToken.kind !== 'string') {
        this.issues.push(
          issue(
            'invalid-predicate-value',
            valueToken.start,
            Math.max(1, valueToken.end - valueToken.start),
            `${name}: requires a value.`,
          ),
        );
        return undefined;
      }
      this.advance();
      if (name === 'kind') {
        const kindValue = valueToken.value.toLowerCase();
        const normalizedKind = kindValue === 'file' ? 'document' : kindValue;
        if (
          normalizedKind !== 'document' &&
          normalizedKind !== 'section' &&
          normalizedKind !== 'block'
        ) {
          this.issues.push(
            issue(
              'invalid-predicate-value',
              valueToken.start,
              valueToken.end - valueToken.start,
              'kind: accepts document, file, section, or block.',
            ),
          );
          return undefined;
        }
        return this.addNode({ kind: 'kind-predicate', value: normalizedKind });
      }
      if (valueToken.value.length === 0) {
        this.issues.push(
          issue(
            'invalid-predicate-value',
            valueToken.start,
            valueToken.end - valueToken.start,
            `${name}: requires a non-empty value.`,
          ),
        );
        return undefined;
      }
      return this.addNode({
        kind: 'string-predicate',
        field: name as GraphQueryStringField,
        value: valueToken.value,
      });
    }

    if (name === 'level') {
      const operatorToken = this.current();
      const operators: Partial<Record<TokenKind, GraphQueryLevelOperator>> = {
        colon: 'eq',
        equals: 'eq',
        lte: 'lte',
        gte: 'gte',
      };
      const operator = operators[operatorToken.kind];
      if (operator === undefined) {
        this.issues.push(
          issue(
            'unexpected-token',
            operatorToken.start,
            Math.max(1, operatorToken.end - operatorToken.start),
            'level requires =, :, <=, or >=.',
          ),
        );
        return undefined;
      }
      this.advance();
      const valueToken = this.current();
      const numeric =
        valueToken.kind !== 'word'
          ? Number.NaN
          : /^#{1,6}$/u.test(valueToken.value)
            ? valueToken.value.length
            : Number(valueToken.value);
      if (!Number.isInteger(numeric) || numeric < 1 || numeric > 6) {
        this.issues.push(
          issue(
            'invalid-predicate-value',
            valueToken.start,
            Math.max(1, valueToken.end - valueToken.start),
            'level accepts a Markdown heading level from 1 through 6.',
          ),
        );
        return undefined;
      }
      this.advance();
      return this.addNode({
        kind: 'level-predicate',
        operator,
        value: numeric as GraphQuerySectionLevel,
      });
    }

    this.issues.push(
      issue(
        'unknown-predicate',
        nameToken.start,
        nameToken.end - nameToken.start,
        `Unknown predicate "${nameToken.value}".`,
      ),
    );
    return undefined;
  }
}

export function parseGraphQuery(query: string): GraphQueryParseResult {
  if (query.length > MAX_GRAPH_QUERY_LENGTH) {
    return {
      valid: false,
      issues: [
        issue(
          'query-too-long',
          MAX_GRAPH_QUERY_LENGTH,
          query.length - MAX_GRAPH_QUERY_LENGTH,
          `A query may contain at most ${MAX_GRAPH_QUERY_LENGTH} characters.`,
        ),
      ],
    };
  }
  if (query.trim().length === 0) {
    return {
      valid: false,
      issues: [issue('empty-query', 0, 0, 'Enter a graph query.')],
    };
  }
  const tokenization = tokenize(query);
  if (tokenization.issues.length > 0)
    return { valid: false, issues: tokenization.issues };
  const parser = new Parser(tokenization.tokens);
  const expression = parser.parse();
  if (expression === undefined) return { valid: false, issues: parser.issues };
  return {
    valid: true,
    expression,
    canonical: formatGraphQuery(expression),
    issues: [],
  };
}
