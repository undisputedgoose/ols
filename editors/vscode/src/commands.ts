import * as vscode from 'vscode';

import { Ctx, Cmd } from './ctx';
import { execFile } from 'child_process';
import path = require('path');
import { promises as fs } from "fs";
import { getDebugConfiguration } from './debug';

export function runDebugTest(ctx: Ctx): Cmd {
    return async(debugConfig: any) => {

        const fn = debugConfig.function;
        const cwd = debugConfig.cwd;
        const pkg = path.basename(cwd);

        var args = [];

        args.push("test");
        args.push(cwd);
        args.push(`-test-name:${fn}`);
        args.push("-debug");

        for(var i = 0; i < ctx.config.collections.length; i++) {
            const name = ctx.config.collections[i].name;
            const path = ctx.config.collections[i].path;
            if(name === "core") {
                continue;
            }
            args.push(`-collection:${name}=${path}`);
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

        if(workspaceFolder === undefined) {
            return;
        }

        const odinExecution = execFile("odin", args, {cwd : workspaceFolder}, (err, stdout, stderr) => {
            if (err) {
                vscode.window.showErrorMessage(err.message);
            }
        });
 
        odinExecution.on("exit", (code) => {

            if(code !== 0) {
                throw Error("Odin test failed!");
            }

            const possibleExecutables = [
                path.join(workspaceFolder, pkg),
                path.join(workspaceFolder, pkg) + '.bin'
            ];

            let promises : Promise<string | null>[] = [];
            possibleExecutables.forEach((executable) => {
                promises.push(new Promise<string | null>((resolve) => {
                    fs.stat(executable).then((stats) => {
                        resolve(executable);
                    }).catch((error) => {
                        resolve(null);
                    });
                }));
            });

            Promise.all(promises).then(results => {
                let found = false;
                results.forEach((r) => {
                    if (r !== null && !found) {
                        found = true;
                        vscode.debug.startDebugging(undefined, getDebugConfiguration(ctx.config, r)).then(r => console.log("Result", r));
                    }
                });
                if (!found) {
                    throw Error("Not possible to find executable, candidates are: " + possibleExecutables);
                }
            });
        });
    };
}

export function runTest(ctx: Ctx): Cmd {

    return async(debugConfig: any) => {
        const fn = debugConfig.function;
        const cwd = debugConfig.cwd;
        const pkg = path.basename(cwd);

        var args = [];

        args.push("test");
        args.push(cwd);
        args.push(`-test-name:${fn}`);

        for(var i = 0; i < ctx.config.collections.length; i++) {
            const name = ctx.config.collections[i].name;
            const path = ctx.config.collections[i].path;
            if(name === "core") {
                continue;
            }
            args.push(`-collection:${name}=${path}`);
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

        if(workspaceFolder === undefined) {
            return;
        }

        var definition = {
            type: "shell",
            command: "run", 
            args: args,
            cwd: workspaceFolder,
        };

        const shellExec = new vscode.ShellExecution("odin", args, { cwd: workspaceFolder});
 
        const target = vscode.workspace.workspaceFolders![0];
        var task = new vscode.Task(definition, target, "Run Test", "odin", shellExec);

        vscode.tasks.executeTask(task);
    };
}