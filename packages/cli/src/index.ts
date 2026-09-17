import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prompts from 'prompts';
import { blue, cyan, green, red, yellow } from 'kolorist';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type Framework = 'react' | 'sveltekit' | 'vue' | 'angular';

export interface ScaffoldOptions {
  /** Select a template without opening the interactive prompt. */
  framework?: Framework;
}

interface PromptResult {
  framework: Framework;
  overwrite?: boolean;
}

export class ScaffoldError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScaffoldError';
  }
}

function copy(src: string, dest: string) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    copyDir(src, dest);
  } else {
    fs.copyFileSync(src, dest);
  }
}

function copyDir(srcDir: string, destDir: string) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const file of fs.readdirSync(srcDir)) {
    const srcFile = path.resolve(srcDir, file);
    const destFile = path.resolve(destDir, file);
    copy(srcFile, destFile);
  }
}

function isEmpty(pathname: string) {
  const files = fs.readdirSync(pathname);
  return files.length === 0 || (files.length === 1 && files[0] === '.git');
}

function isWithin(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return (
    relative === '' ||
    (!relative.startsWith('..' + path.sep) &&
      relative !== '..' &&
      !path.isAbsolute(relative))
  );
}

function nearestExistingAncestor(pathname: string): string {
  let current = pathname;
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) return current;
    current = parent;
  }
  return current;
}

function packageNameFor(targetDir: string): string {
  const packageName = path.basename(targetDir);
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(packageName)) {
    throw new ScaffoldError(
      `The target directory name "${packageName}" is not a valid npm package name.`
    );
  }
  return packageName;
}

export function resolveTarget(projectName: string): {
  targetDir: string;
  packageName: string;
} {
  if (!projectName.trim() || projectName.includes('\0')) {
    throw new ScaffoldError('Project name must be a non-empty relative path.');
  }

  const segments = projectName.split(/[\\/]+/);
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new ScaffoldError('Project path must not contain . or .. segments.');
  }

  const cwd = path.resolve(process.cwd());
  if (path.isAbsolute(projectName)) {
    throw new ScaffoldError(
      'Project path must be a relative child of the current directory.'
    );
  }

  const targetDir = path.resolve(cwd, projectName);
  if (!isWithin(cwd, targetDir) || targetDir === cwd) {
    throw new ScaffoldError(
      'Project path must be a child of the current directory.'
    );
  }

  const realCwd = fs.realpathSync(cwd);
  const ancestor = nearestExistingAncestor(targetDir);
  const realAncestor = fs.realpathSync(ancestor);
  if (!isWithin(realCwd, realAncestor)) {
    throw new ScaffoldError(
      'Project path resolves outside the current directory.'
    );
  }

  if (fs.existsSync(targetDir)) {
    if (!fs.statSync(targetDir).isDirectory()) {
      throw new ScaffoldError(`Target path is not a directory: ${targetDir}`);
    }
    if (!isWithin(realCwd, fs.realpathSync(targetDir))) {
      throw new ScaffoldError(
        'Project path resolves outside the current directory.'
      );
    }
  }

  return { targetDir, packageName: packageNameFor(targetDir) };
}

function emptyDir(dir: string) {
  if (!fs.existsSync(dir)) {
    return;
  }
  for (const file of fs.readdirSync(dir)) {
    if (file === '.git') {
      continue;
    }
    fs.rmSync(path.resolve(dir, file), { recursive: true, force: true });
  }
}

function replaceInFile(filePath: string, replacements: Record<string, string>) {
  let content = fs.readFileSync(filePath, 'utf-8');
  for (const [key, value] of Object.entries(replacements)) {
    content = content.split(key).join(value);
  }
  fs.writeFileSync(filePath, content, 'utf-8');
}

export const FRAMEWORK_CHOICES: Array<{ title: string; value: Framework }> = [
  { title: 'React', value: 'react' },
  { title: 'SvelteKit', value: 'sveltekit' },
  { title: 'Vue', value: 'vue' },
  { title: 'Angular', value: 'angular' },
];

export async function scaffold(
  projectName: string,
  options: ScaffoldOptions = {}
): Promise<void> {
  const { targetDir, packageName } = resolveTarget(projectName);
  const templateRoot = path.join(__dirname, '..', 'templates');

  if (!fs.existsSync(templateRoot)) {
    throw new ScaffoldError(`Template directory not found: ${templateRoot}`);
  }

  if (fs.existsSync(targetDir) && !isEmpty(targetDir)) {
    const { overwrite }: { overwrite?: boolean } = await prompts({
      type: 'confirm',
      name: 'overwrite',
      message: `Target directory "${targetDir}" is not empty. Remove existing files and continue?`,
      initial: false,
    });

    if (!overwrite) {
      console.log(red('✖') + ' Operation cancelled');
      throw new ScaffoldError('Operation cancelled.');
    }

    emptyDir(targetDir);
  }

  const answers: PromptResult = options.framework
    ? { framework: options.framework }
    : await prompts([
        {
          type: 'select',
          name: 'framework',
          message: 'Select a UI framework:',
          choices: FRAMEWORK_CHOICES,
          initial: 0,
        },
      ]);

  const framework = answers.framework;

  if (!framework) {
    console.log(red('✖') + ' Operation cancelled');
    throw new ScaffoldError('Operation cancelled.');
  }

  console.log();
  console.log(`Scaffolding Nearstack project in ${cyan(targetDir)}...`);
  console.log();

  const templateDir = path.join(templateRoot, framework);

  if (!fs.existsSync(templateDir)) {
    throw new ScaffoldError(`Template directory not found: ${templateDir}`);
  }

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  copyDir(templateDir, targetDir);

  const filesToReplace = [
    path.join(targetDir, 'package.json'),
    path.join(targetDir, 'index.html'),
    path.join(targetDir, 'public', 'manifest.json'),
    path.join(targetDir, 'vite.config.ts'),
    path.join(targetDir, 'angular.json'),
  ];

  for (const file of filesToReplace) {
    if (fs.existsSync(file)) {
      replaceInFile(file, {
        '{{PROJECT_NAME}}': packageName,
      });
    }
  }

  console.log(green('✓') + ' Project created successfully!');
  console.log();
  console.log('Next steps:');
  console.log();
  console.log(`  ${blue('cd')} ${projectName}`);
  console.log(
    `  ${blue('npm install')}  ${yellow('# or pnpm install, yarn install')}`
  );
  console.log(
    `  ${blue('npm run dev')}   ${yellow('# start the development server')}`
  );
  console.log();
  console.log('Happy coding! 🚀');
  console.log();
}
