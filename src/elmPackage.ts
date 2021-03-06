import * as vscode from 'vscode';
import * as path from 'path';
import * as utils from './elmUtils';

const request = require('request');
let packageTerminal: vscode.Terminal;

function getInstallPackageCommand(packageName): string {
  const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('elm');
  const dummyPath = path.join(vscode.workspace.rootPath, 'dummyfile');
  const [_, elmVersion] = utils.detectProjectRootAndElmVersion(dummyPath, vscode.workspace.rootPath)
  const args018 = 'elm-package install ' + packageName + ' --yes';
  const args019 = 'elm install ' + packageName;
  const args = utils.isElm019(elmVersion) ? args019 : args018;

  return args;
}

function browsePackage(): Promise<void> {
  const quickPickPackageOptions: vscode.QuickPickOptions = {
    matchOnDescription: true,
    placeHolder: 'Choose a package',
  };
  const quickPickVersionOptions: vscode.QuickPickOptions = {
    matchOnDescription: false,
    placeHolder: 'Choose a version, or press <esc> to browse the latest',
  };


  return getJSON()
    .then(transformToPackageQuickPickItems)
    .then(packages =>
      vscode.window.showQuickPick(packages, quickPickPackageOptions),
    )
    .then(selectedPackage => {
      if (selectedPackage === undefined) {
        return; // no package
      }
      return vscode.window
        .showQuickPick(
          transformToPackageVersionQuickPickItems(selectedPackage),
          quickPickVersionOptions,
        )
        .then(selectedVersion => {
          let uri = selectedVersion
            ? vscode.Uri.parse(
              'https://package.elm-lang.org/packages/' +
              selectedPackage.label +
              '/' +
              selectedVersion.label,
            )
            : vscode.Uri.parse(
              'https://package.elm-lang.org/packages/' +
              selectedPackage.label +
              '/latest',
            );
          vscode.commands.executeCommand('vscode.open', uri);
        }).then(() => { });
    });
}

interface ElmPackageQuickPickItem extends vscode.QuickPickItem {
  info: any;
}


function transformToPackageQuickPickItems(
  packages: any[],
): ElmPackageQuickPickItem[] {
  return Object.keys(packages).map(item => {
    return { label: item, description: item, info: packages[item] };
  });
}

function transformToPackageVersionQuickPickItems(
  selectedPackage: ElmPackageQuickPickItem,
): vscode.QuickPickItem[] {
  return selectedPackage.info.map(version => {
    return { label: version, description: null };
  });
}

function runInstall(): Thenable<void> {
  const quickPickOptions: vscode.QuickPickOptions = {
    matchOnDescription: true,
    placeHolder:
      'Choose a package, or press <esc> to install all packages in elm-package.json',
  };

  return getJSON()
    .then(transformToQuickPickItems)
    .then(items => vscode.window.showQuickPick(items, quickPickOptions))
    .then(value => {
      const packageName = value ? value.label : '';
      return installPackageInTerminal(packageName)
    });
}

function installPackageInTerminal(packageToInstall: string) {
  try {
    let installPackageCommand = getInstallPackageCommand(packageToInstall);
    if (packageTerminal !== undefined) { packageTerminal.dispose(); }
    packageTerminal = vscode.window.createTerminal('Elm Package Install');
    let [installPackageLaunchCommand, clearCommand] = utils.getTerminalLaunchCommands(installPackageCommand);
    packageTerminal.sendText(clearCommand, true);
    packageTerminal.sendText(installPackageLaunchCommand, true);
    packageTerminal.show(false);
  } catch (error) {
    vscode.window.showErrorMessage('Cannot start Elm Package install. ' + error);
  }

}

function getJSON(): Promise<any[]> {
  return new Promise((resolve, reject) => {
    request('https://package.elm-lang.org/all-packages', (err, _, body) => {
      if (err) {
        reject(err);
      } else {
        let json;
        try {
          json = JSON.parse(body);
        } catch (e) {
          reject(e);
        }
        resolve(json);
      }
    });
  });
}

function transformToQuickPickItems(packages: any[]): vscode.QuickPickItem[] {
  return Object.keys(packages).map(item => {
    return { label: item, description: '', info: packages[item] };
  });
}

vscode.window.onDidCloseTerminal((terminal) => {
  if (terminal.name === 'Elm Package Install') {
    packageTerminal = undefined;
  }
});

export function activatePackage(): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('elm.install', runInstall),
    vscode.commands.registerCommand('elm.browsePackage', browsePackage),
  ];
}
