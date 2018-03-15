import * as typo from "./typo";

declare global {
    function define(deps: string[], factory: () => any): void;
}

define([], () => {
    return typo;
});
