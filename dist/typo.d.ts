export interface ITypo {
    check(word: string): boolean;
    suggest(word: string, limit?: number): string[];
}
export declare function createTypo(affData: string, wordsData: string): ITypo;
