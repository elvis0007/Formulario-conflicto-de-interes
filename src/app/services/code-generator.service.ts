import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CodeGeneratorService {
  private readonly STORAGE_KEY = 'generated_codes';

  constructor() {}

  generateUniqueCode(): string {
    const existingCodes = this.getAllCodes();
    let code: string;
    let attempts = 0;
    const maxAttempts = 1000;

    do {
      code = this.generateRandomCode();
      attempts++;
      if (attempts > maxAttempts) {
        throw new Error('No se pudo generar un código único después de múltiples intentos');
      }
    } while (existingCodes.includes(code));

    this.saveCode(code);
    return code;
  }

  private generateRandomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private getAllCodes(): string[] {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  private saveCode(code: string): void {
    const codes = this.getAllCodes();
    codes.push(code);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(codes));
  }

  getAllGeneratedCodes(): string[] {
    return this.getAllCodes();
  }

  clearAllCodes(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}
