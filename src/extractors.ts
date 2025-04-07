import { XMLParser } from "fast-xml-parser";
import { strFromU8, unzip, unzipSync } from "fflate";
import { resolvePDFJS } from "pdfjs-serverless";

interface BaseResumeDataExtractor {
    extractTextData(fileData: ArrayBuffer): Promise<string> | string;
}

class PDFJSExtractor implements BaseResumeDataExtractor {
    async extractTextData(fileData: ArrayBuffer): Promise<string> {
      const { getDocument } = await resolvePDFJS();
      const doc = await getDocument({ data: fileData }).promise;

      const pageContents: string[] = [];

      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const textContent = await page.getTextContent()
        const contents = textContent.items.map(item => (item as any).str).join(' ')
        pageContents.push(contents);
      }

      return pageContents.join('\n');
    }
}


// IN PROGRESS, NEEDS TESTING
class FastXMLExtractor implements BaseResumeDataExtractor {
  parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({ ignoreAttributes: false });
  }

  extractTextFromXml(xmlString: string): string {
    const json = this.parser.parse(xmlString);
    const body = json['w:document']?.['w:body'];
    if (!body) return '';

    const paragraphs = Array.isArray(body['w:p']) ? body['w:p'] : [body['w:p']];
    return paragraphs
      .map(p => {
        const runs = Array.isArray(p['w:r']) ? p['w:r'] : [p['w:r']];
        return runs
          .map(r => r?.['w:t']?.['#text'] || r?.['w:t'] || '')
          .join('');
      })
      .join('\n')
      .trim();
  }

  async extractTextData(arrayBuffer: ArrayBuffer): Promise<string> {
    const uint8 = new Uint8Array(arrayBuffer);
    const files: Record<string, Uint8Array> = await new Promise((resolve, reject) => {
      unzip(uint8, (err, files) => {
      if (err) reject(err);
      else resolve(files);
    })});

    const targetPaths = [
      'word/document.xml',
      ...Object.keys(files).filter(p =>
        /^word\/(header|footer)\d*\.xml$/.test(p) ||
        p === 'word/footnotes.xml' ||
        p === 'word/endnotes.xml'
      ),
    ];

    const allText = targetPaths
      .map(path => {
        const file = files[path];
        if (!file) return '';
        const xml = strFromU8(file);
        return this.extractTextFromXml(xml);
      })
      .filter(Boolean)
      .join('\n\n');

    return allText;
  }
}

export class ResumeExtractor {
    private extractor: BaseResumeDataExtractor;

    constructor(fileType: 'pdf' | 'docx') {
      this.extractor = this.createExtractor(fileType);
    }

    private createExtractor(fileType: 'pdf' | 'docx'): BaseResumeDataExtractor {
      switch (fileType) {
        case 'pdf':
          return new PDFJSExtractor();
        case 'docx':
          return new FastXMLExtractor();
        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }
    }

    async extractTextData(fileData: any): Promise<string> {
      return this.extractor.extractTextData(fileData);
    }
}