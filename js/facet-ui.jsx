import React, { useEffect } from 'react';
import { useFacetState } from '@react-facet/core';
import { createRoot } from '@react-facet/dom-fiber';

function SelectionReadout() {
	const [selection, setSelection] = useFacetState('Choose a glyph to inspect');

	useEffect(() => {
		const updateSelection = event => {
			const hex = String(event.detail?.hex || '').replace(/^0x/i, '').toUpperCase();
			const position = String(event.detail?.position || '');
			setSelection(hex ? `U+${hex} at ${position}` : 'Choose a glyph to inspect');
		};

		document.addEventListener('glyphtools:selection', updateSelection);
		return () => document.removeEventListener('glyphtools:selection', updateSelection);
	}, [setSelection]);

	return React.createElement('fast-text', { text: selection });
}

const selectionRoot = document.getElementById('facetSelectionRoot');
if (selectionRoot) createRoot(selectionRoot).render(React.createElement(SelectionReadout));
