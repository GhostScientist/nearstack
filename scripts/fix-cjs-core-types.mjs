import fs from 'node:fs';
import process from 'node:process';
import ts from 'typescript';

// tsup 8's declaration bundler drops type-only import attributes. Core only
// supplies types to the React bundle and is ESM-only, so a CommonJS consumer
// must resolve those types in import mode (including under Node16 resolution).
const file = process.argv[2];
const contents = fs.readFileSync(file, 'utf8');
const source = ts.createSourceFile(
  file,
  contents,
  ts.ScriptTarget.Latest,
  true
);
const printer = ts.createPrinter();
let result = contents;
for (const statement of [...source.statements].reverse()) {
  if (
    !ts.isImportDeclaration(statement) ||
    !ts.isStringLiteral(statement.moduleSpecifier) ||
    statement.moduleSpecifier.text !== '@nearstack-dev/core' ||
    !statement.importClause
  )
    continue;

  const updated = ts.factory.updateImportDeclaration(
    statement,
    statement.modifiers,
    ts.factory.updateImportClause(
      statement.importClause,
      true,
      statement.importClause.name,
      statement.importClause.namedBindings
    ),
    statement.moduleSpecifier,
    ts.factory.createImportAttributes([
      ts.factory.createImportAttribute(
        ts.factory.createStringLiteral('resolution-mode'),
        ts.factory.createStringLiteral('import')
      ),
    ])
  );
  result =
    result.slice(0, statement.getStart(source)) +
    printer.printNode(ts.EmitHint.Unspecified, updated, source) +
    result.slice(statement.end);
}
fs.writeFileSync(file, result);
