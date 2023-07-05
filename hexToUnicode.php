<?php

function hexToUnicode(string $hexValue): string {
	$hexValue = '0xE000';
	$result = mb_chr(hexdec($hexValue), 'UTF-8');
	return $result;
}
