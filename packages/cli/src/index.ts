import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prompts from 'prompts';
import { blue, cyan, green, red, yellow } from 'kolorist';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type Framework = 'react' | 'sveltekit' | 'vue' | 'angular';

interface PromptResult {
  framework: Framework;
  overwrite?: boolean;
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
    content = content.replace(new RegExp(key, 'g'), value);
  }
  fs.writeFileSync(filePath, content, 'utf-8');
}

export const FRAMEWORK_CHOICES: Array<{ title: string; value: Framework }> = [
  { title: 'React', value: 'react' },
  { title: 'SvelteKit', value: 'sveltekit' },
  { title: 'Vue', value: 'vue' },
  { title: 'Angular', value: 'angular' },
];

export async function scaffold(projectName: string): Promise<void> {
  const cwd = process.cwd();
  const targetDir = path.join(cwd, projectName);

  if (fs.existsSync(targetDir) && !isEmpty(targetDir)) {
    const { overwrite }: { overwrite?: boolean } = await prompts({
      type: 'confirm',
      name: 'overwrite',
      message: `Target directory "${projectName}" is not empty. Remove existing files and continue?`,
      initial: false,
    });

    if (!overwrite) {
      console.log(red('✖') + ' Operation cancelled');
      process.exit(1);
    }

    emptyDir(targetDir);
  }

  const answers: PromptResult = await prompts([
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
    process.exit(1);
  }

  console.log();
  console.log(`Scaffolding Nearstack project in ${cyan(targetDir)}...`);
  console.log();

  const templateDir = path.join(__dirname, '..', 'templates', framework);

  if (!fs.existsSync(templateDir)) {
    console.error(red(`Template directory not found: ${templateDir}`));
    process.exit(1);
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
        '{{PROJECT_NAME}}': projectName,
      });
    }
  }

  console.log(green('✓') + ' Project created successfully!');
  console.log();
  console.log('Next steps:');
  console.log();
  console.log(`  ${blue('cd')} ${projectName}`);
  console.log(`  ${blue('npm install')}  ${yellow('# or pnpm install, yarn install')}`);
  console.log(`  ${blue('npm run dev')}   ${yellow('# start the development server')}`);
  console.log();
  console.log('Happy coding! 🚀');
  console.log();
}
