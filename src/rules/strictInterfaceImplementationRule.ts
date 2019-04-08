/**
 * @license
 * Copyright 2019 Palantir Technologies, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as ts from "typescript";

import { IRuleMetadata } from "..";
import { RuleFailure } from "../language/rule/rule";
import { ProgramAwareRuleWalker } from '../language/walker';
import { TypedRule } from "../rules";
import { isSymbolFlagSet } from 'tsutils';
import { find } from '../utils';

export class Rule extends TypedRule {
    public static metadata: IRuleMetadata = {
        description: "Ensures interfaces are strictly implemented on classes",
        hasFix: false,
        options: {},
        optionsDescription: "no options",
        requiresTypeInfo: true,
        ruleName: "strict-inteface-implementation",
        type: "typescript",
        typescriptOnly: true,
    };
    public applyWithProgram(sourceFile: ts.SourceFile, program: ts.Program): RuleFailure[] {
        return this.applyWithWalker(
            new InterfaceImplementationWalker(sourceFile, this.getOptions(), program),
        );
    }
}

class InterfaceImplementationWalker extends ProgramAwareRuleWalker {
    public walk(sourceFile: ts.SourceFile): void {
        const callback = (node: ts.Node): void => {
            switch (node.kind) {
                case ts.SyntaxKind.ClassDeclaration:
                    this.checkInterfaceImplementation(node as ts.ClassDeclaration);
            }
            ts.forEachChild(node, callback);
        };
        ts.forEachChild(sourceFile, callback);
    }
    private checkInterfaceImplementation(node: ts.ClassDeclaration): void {
        const interfaces = this.getAllInterfacesImplementedInClass(node);
        ts.visitEachChild(
            node,
            (child): ts.VisitResult<ts.Node> => {
                if (ts.isMethodDeclaration(child)) {
                    const interfaceMethodSignature = this.getInterfaceMethodWithName(
                        child.name,
                        interfaces,
                    );
                    if (!interfaceMethodSignature) {
                        return child;
                    }
                    this.analyseMethods(child, interfaceMethodSignature);
                }
                return child;
            },
            null,
        );
    }
    private getInterfaceMethodWithName(
        name: ts.PropertyName,
        interfaces: ts.InterfaceDeclaration[],
    ): ts.MethodSignature | undefined {
        for (const interfaceDeclaration of interfaces) {
            const methods = interfaceDeclaration.members.filter(ts.isMethodSignature);
            for (const method of methods) {
                if (method.name.getText() === name.getText()) {
                    return method;
                }
            }
        }
        return;
    }

    private getAllInterfacesImplementedInClass(
        node: ts.ClassDeclaration,
    ): ts.InterfaceDeclaration[] {
        const typeChecker = this.getTypeChecker();
        const declarations: ts.InterfaceDeclaration[] = [];
        for (const name of this.getInterfacesNamesImplementedInClass(node)) {
            const symbol = typeChecker.getSymbolAtLocation(name.expression);
            if (!symbol) {
                continue;
            }
            const interfaceDeclarations = symbol.declarations.filter(declaration =>
                ts.isInterfaceDeclaration(declaration),
            ) as ts.InterfaceDeclaration[];
            declarations.push(...interfaceDeclarations);
        }
        return declarations;
    }

    private getInterfacesNamesImplementedInClass(
        node: ts.ClassDeclaration,
    ): ts.ExpressionWithTypeArguments[] {
        if (!node.heritageClauses) {
            return [];
        }
        const interfaces: ts.ExpressionWithTypeArguments[] = [];
        node.heritageClauses
            .filter(heritage => heritage.token === ts.SyntaxKind.ImplementsKeyword)
            .forEach(heritage => interfaces.push(...heritage.types));
        return interfaces;
    }

    private analyseMethods(
        declaredMethod: ts.MethodDeclaration,
        interfaceMethod: ts.MethodSignature,
    ): void {
        const interfaceParameters = interfaceMethod.parameters;
        const implementingParameters = declaredMethod.parameters;
        for (let i = 0; i <= interfaceParameters.length; i++) {
            const interfaceParameter = interfaceParameters[i];
            const implementingParameter = implementingParameters[i];
            // needs isRelatedTo
            interfaceParameter.type;
        }
    }
}
