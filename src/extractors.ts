import { PDFDocumentProxy, resolvePDFJS } from "pdfjs-serverless";

interface BaseResumeDataExtractor {
    extractTextData(): Promise<string>;
}

class PDFJSExtractor implements BaseResumeDataExtractor {
    doc: PDFDocumentProxy | null = null;
    fileData: any;

    constructor(fileData: any) {
      this.fileData = fileData;
    }

    private async initialize(): Promise<void> {
      const { getDocument } = await resolvePDFJS();
      this.doc = await getDocument({ data: this.fileData }).promise;
    }

    private async getDoc(): Promise<PDFDocumentProxy> {
      if (!this.doc) {
        const doc = await this.initialize();
      }

      return this.doc as PDFDocumentProxy;
    }

    async extractTextData(): Promise<string> {
      const doc = await this.getDoc();

      const pageContents: string[] = [];

      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const textContent = await page.getTextContent()
        const contents = textContent.items.map(item => (item as any).str).join(' ')
        pageContents.push(contents);
      }

      return pageContents.join('\n');
    }

    extractImageData(): string {
      return '';
    }

    extractTextAndImageData(): string {
      return '';
    }
}

export class ResumeExtractor {
    private extractor: BaseResumeDataExtractor;
    private extractorType: string = process.env.EXTRACTOR_TYPE || 'pdfjs';

    constructor(fileData: any) {
      this.extractor = this.createExtractor(fileData)
    }

    private createExtractor(fileData: any): BaseResumeDataExtractor {
      switch (this.extractorType) {
        case 'pdfjs':
          return new PDFJSExtractor(fileData);
        default:
          throw new Error(`Unsupported extractor type: ${this.extractorType}`);
      }
    }

    async extractTextData(): Promise<string> {
      return this.extractor.extractTextData();
    }
}