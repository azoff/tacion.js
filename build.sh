#!/bin/bash

SRC=src/client/tacion.js
DST=src/client/tacion.min.js

# minifies tacion and gives it a spiffy header
uglifyjs $SRC | tr '\n' ' ' | \
sed 's/\*  \* Tacion v/ Tacion v/g' | \
sed 's/ \*  A.*\*\//| GPLv2 + MIT | http:\/\/azof.fr\/tacionjs *\/ /g' \
> $DST