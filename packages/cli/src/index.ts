// nearstack CLI that can scaffold a blank app

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prompts from 'prompts';
import { blue, cyan, green, red, yellow } from 'kolorist';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface PromptResult {
  framework: 'react' | 'svelte';
  includeAI: boolean;
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

function isEmpty(path: string) {
  const files = fs.readdirSync(path);
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

function stripAIFromReactTemplate(targetDir: string) {
  const packagePath = path.join(targetDir, 'package.json');
  const appPath = path.join(targetDir, 'src', 'App.tsx');
  const chatComponentPath = path.join(targetDir, 'src', 'components', 'Chat.tsx');
  const modelSetupComponentPath = path.join(targetDir, 'src', 'components', 'ModelSetup.tsx');

  // Remove AI dependencies from package.json
  if (fs.existsSync(packagePath)) {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
    delete pkg.dependencies['@nearstack-dev/ai'];
    delete pkg.dependencies['@mlc-ai/web-llm'];
    fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf-8');
  }

  // Remove AI component files
  if (fs.existsSync(chatComponentPath)) {
    fs.unlinkSync(chatComponentPath);
  }
  if (fs.existsSync(modelSetupComponentPath)) {
    fs.unlinkSync(modelSetupComponentPath);
  }

  // Rewrite App.tsx to remove AI imports and usage
  if (fs.existsSync(appPath)) {
    fs.writeFileSync(
      appPath,
      `import { TodoList } from './components/TodoList';\nimport './App.css';\n\nfunction App() {\n  return (\n    <div className="layout">\n      <main>\n        <h1>Nearstack</h1>\n        <p>Local-first todos.</p>\n        <TodoList />\n      </main>\n    </div>\n  );\n}\n\nexport default App;\n`,
      'utf-8'
    );
  }
}

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
      choices: [
        { title: 'React', value: 'react' },
        { title: 'Svelte', value: 'svelte' },
      ],
      initial: 0,
    },
    {
      type: (prev) => (prev === 'react' ? 'confirm' : null),
      name: 'includeAI',
      message: 'Include AI features?',
      initial: true,
    },
  ]);

  const framework = answers.framework;
  const includeAI = answers.includeAI ?? true;

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

  if (framework === 'react' && !includeAI) {
    stripAIFromReactTemplate(targetDir);
  }

  const filesToReplace = [
    path.join(targetDir, 'package.json'),
    path.join(targetDir, 'index.html'),
    path.join(targetDir, 'public', 'manifest.json'),
    path.join(targetDir, 'vite.config.ts'),
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
