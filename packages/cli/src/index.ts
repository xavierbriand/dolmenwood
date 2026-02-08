#!/usr/bin/env node
import { coreHello } from '@dolmenwood/core';
import { dataHello } from '@dolmenwood/data';

console.log('CLI Starting...');
console.log(coreHello());
console.log(dataHello());
