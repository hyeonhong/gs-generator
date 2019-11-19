#!/usr/bin/env bash

node token_generator.js
mkdir auth/$1
cp credentials.json token.json auth/$1
rm credentials.json token.json
