import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, shareReplay } from 'rxjs/operators';
import { Observable } from 'rxjs';

export interface IconMetadata {
    name: string;
    version: number;
    popularity: number;
    codepoint: number;
    unsupported_families: string[];
    categories: string[];
    tags: string[];
    sizes_px?: number[];
}

export interface IconsResponse {
    host: string;
    asset_url_pattern: string;
    families: string[];
    icons: IconMetadata[];
    categories?: string[];
}

@Injectable({
    providedIn: 'root'
})
export class IconService {
    private http = inject(HttpClient);
    // Using relative path for proxying through dev server to avoid CORS
    private metadataUrl = '/metadata/icons?key=material_symbols&incomplete=true';

    private metadata$ = this.http.get(this.metadataUrl, { responseType: 'text' }).pipe(
        map(response => {
            // Remove the security prefix )]}'
            const jsonStr = response.substring(response.indexOf('{'));
            return JSON.parse(jsonStr) as IconsResponse;
        }),
        shareReplay(1)
    );

    getIcons(): Observable<IconMetadata[]> {
        return this.metadata$.pipe(map(res => res.icons));
    }

    getFamilies(): Observable<string[]> {
        return this.metadata$.pipe(map(res => res.families));
    }

    getCategories(): Observable<string[]> {
        return this.metadata$.pipe(map(res => res.categories || []));
    }

    getSvgUrl(
        icon: string,
        family: string = 'Material Icons',
        axes: { wght?: number; fill?: number; grad?: number; opsz?: number } = {},
        version: number = 1
    ): string {
        const isSymbol = family.startsWith('Material Symbols');

        if (isSymbol) {
            const familyMap: { [key: string]: string } = {
                'Material Symbols Outlined': 'materialsymbolsoutlined',
                'Material Symbols Rounded': 'materialsymbolsrounded',
                'Material Symbols Sharp': 'materialsymbolssharp'
            };
            const familyFolder = familyMap[family] || 'materialsymbolsoutlined';

            // Construct axes string in strict order: wght, grad, fill
            const axisParts: string[] = [];

            // If any axis is non-default, we should probably include the relevant ones.
            // Google's static server is picky about the order: wght -> grad -> fill.
            if (axes.wght !== undefined && axes.wght !== 400) axisParts.push(`wght${axes.wght}`);
            if (axes.grad !== undefined && axes.grad !== 0) axisParts.push(`grad${axes.grad}`);
            if (axes.fill !== undefined && axes.fill !== 0) axisParts.push(`fill${axes.fill}`);

            const axesStr = axisParts.length > 0 ? axisParts.join('') : 'default';
            const opsz = axes.opsz || 24;

            return `https://fonts.gstatic.com/s/i/short-term/release/${familyFolder}/${icon}/${axesStr}/${opsz}px.svg`;
        } else {
            const familyMap: { [key: string]: string } = {
                'Material Icons': 'materialicons',
                'Material Icons Outlined': 'materialiconsoutlined',
                'Material Icons Round': 'materialiconsround',
                'Material Icons Sharp': 'materialiconssharp',
                'Material Icons Two Tone': 'materialiconstwotone'
            };
            const familyFolder = familyMap[family] || 'materialicons';
            return `https://fonts.gstatic.com/s/i/materialicons/${icon}/v${version}/24px.svg`.replace(
                'materialicons',
                familyFolder
            );
        }
    }
}
