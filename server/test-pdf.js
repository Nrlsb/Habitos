const pdfParse = require('pdf-parse');
console.log('Type of pdfParse:', typeof pdfParse);
if (typeof pdfParse === 'function') {
    console.log('SUCCESS: pdfParse is a function');
} else {
    console.log('FAILURE: pdfParse is NOT a function. It is:', pdfParse);
}

async function testImport() {
    try {
        const pdfParseImport = await import('pdf-parse');
        console.log('Import result keys:', Object.keys(pdfParseImport));
        console.log('Type of default export:', typeof pdfParseImport.default);
    } catch (err) {
        console.error('Import failed:', err.message);
    }
}

testImport();
