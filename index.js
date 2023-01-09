import path from 'path';
import typescript from 'typescript';
import stripComments from 'strip-comments';
import { inspect } from 'util';

const tsRegex = /\.[mc]?ts$/;
const tsxRegex = /\.([mc]?tsx?)$/;

const decoratorsRegex = new RegExp(/((?<![\(\s]\s*['"])@\w*[\w\d]\s*(?![;])[\((?=\s)])/);

const findDecorators = (fileContent) => decoratorsRegex.test(stripComments(fileContent));

// Plugins for esbuild:
// 1. esbuild-plugin-ts-decorators
// https://github.com/andreisergiu98/esbuild-plugin-ts-decorators
// https://github.com/andreisergiu98/esbuild-plugin-ts-decorators/blob/main/src/plugin.ts

// 2. esbuild-plugin-typescript-decorators
// https://github.com/jcindex/esbuild-plugin-typescript-decorators
// https://github.com/jcindex/esbuild-plugin-typescript-decorators/blob/main/src/esbuild-plugin-typescript-decorators.ts

export default function emitDecoratorMetadata({
    tsconfigPath = path.join(process.cwd(), './tsconfig.json'),
    forceTsc = false,
    tsx = true,
  } = {}) {

  let parsedTsConfig = null;

  const fileRegex = tsx ? tsxRegex : tsRegex;

  return {
    name: 'transform-file',
    enforce: 'pre',

    async transform(src, id) {

      if (fileRegex.test(id)) {

        if (!parsedTsConfig) {
          parsedTsConfig = parseTsConfig(tsconfigPath, process.cwd());
          if (parsedTsConfig.sourcemap) {
            parsedTsConfig.sourcemap = false;
            parsedTsConfig.inlineSources = true;
            parsedTsConfig.inlineSourceMap = true;
          }
        }
  
        // Just return if we don't need to search the file.
        if (
          !forceTsc &&
          (!parsedTsConfig ||
            !parsedTsConfig.options ||
            !parsedTsConfig.options.emitDecoratorMetadata)
        ) {
          return;
        }
  
        // Find the decorator and if there isn't one, return out
        const hasDecorator = findDecorators(src);
  
        console.log("hasDecorator: ", hasDecorator);
        if (!hasDecorator) {
          return;
        }

        const program = typescript.transpileModule(src, { compilerOptions: parsedTsConfig.options });

        return {
          code: program.outputText,
          map: null
        }
      }
    },
  }
}

function parseTsConfig(tsconfig, cwd = process.cwd()) {
  const fileName = typescript.findConfigFile(
    cwd,
    typescript.sys.fileExists,
    tsconfig
  );

  // if the value was provided, but no file, fail hard
  if (tsconfig !== undefined && !fileName)
    throw new Error(`failed to open '${fileName}'`);

  let loadedConfig = {};
  let baseDir = cwd;
  let configFileName;
  if (fileName) {
    const text = typescript.sys.readFile(fileName);
    if (text === undefined) throw new Error(`failed to read '${fileName}'`);

    const result = typescript.parseConfigFileTextToJson(fileName, text);

    if (result.error !== undefined) {
      printDiagnostics(result.error);
      throw new Error(`failed to parse '${fileName}'`);
    }

    loadedConfig = result.config;
    baseDir = path.dirname(fileName);
    configFileName = fileName;
  }

  const parsedTsConfig = typescript.parseJsonConfigFileContent(
    loadedConfig,
    typescript.sys,
    baseDir
  );

  if (parsedTsConfig.errors[0]) printDiagnostics(parsedTsConfig.errors);

  return parsedTsConfig;
}

function printDiagnostics(...args) {
  console.log(inspect(args, false, 10, true));
}