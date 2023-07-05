<?php

declare(strict_types=1);

class Tools {

	public static function hexToUnicode(string $hexValue): string {
		$result = mb_chr(hexdec($hexValue), 'UTF-8');
		return $result;
	}

	public static function unicodeToHex(string $unicodeValue): string {
		$result = dechex(mb_ord($unicodeValue));
		$result = "0x" . strtoupper($result);
		return $result;
	}
}
