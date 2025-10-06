// nearstack CLI that can scaffold a blank app
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prompts from 'prompts';
import { blue, cyan, green, red, yellow } from 'kolorist';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
function copy(src, dest) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        copyDir(src, dest);
    }
    else {
        fs.copyFileSync(src, dest);
    }
}
function copyDir(srcDir, destDir) {
    fs.mkdirSync(destDir, { recursive: true });
    for (const file of fs.readdirSync(srcDir)) {
        const srcFile = path.resolve(srcDir, file);
        const destFile = path.resolve(destDir, file);
        copy(srcFile, destFile);
    }
}
function isEmpty(path) {
    const files = fs.readdirSync(path);
    return files.length === 0 || (files.length === 1 && files[0] === '.git');
}
function emptyDir(dir) {
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
function replaceInFile(filePath, replacements) {
    let content = fs.readFileSync(filePath, 'utf-8');
    for (const [key, value] of Object.entries(replacements)) {
        content = content.replace(new RegExp(key, 'g'), value);
    }
    fs.writeFileSync(filePath, content, 'utf-8');
}
export async function scaffold(projectName) {
    const cwd = process.cwd();
    const targetDir = path.join(cwd, projectName);
    // Check if directory exists
    if (fs.existsSync(targetDir) && !isEmpty(targetDir)) {
        const { overwrite } = await prompts({
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
    // Prompt for framework choice
    const { framework } = await prompts({
        type: 'select',
        name: 'framework',
        message: 'Select a UI framework:',
        choices: [
            { title: 'React', value: 'react' },
            { title: 'Svelte', value: 'svelte' },
        ],
        initial: 0,
    });
    if (!framework) {
        console.log(red('✖') + ' Operation cancelled');
        process.exit(1);
    }
    console.log();
    console.log(`Scaffolding Nearstack project in ${cyan(targetDir)}...`);
    console.log();
    // Get template directory
    const templateDir = path.join(__dirname, '..', 'templates', framework);
    if (!fs.existsSync(templateDir)) {
        console.error(red(`Template directory not found: ${templateDir}`));
        process.exit(1);
    }
    // Create target directory
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }
    // Copy template files
    copyDir(templateDir, targetDir);
    // Replace project name in files
    const filesToReplace = [
        path.join(targetDir, 'package.json'),
        path.join(targetDir, 'index.html'),
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
//# sourceMappingURL=index.js.map