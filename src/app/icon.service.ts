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
}

export interface IconsResponse {
    host: string;
    asset_url_pattern: string;
    families: string[];
    icons: IconMetadata[];
}

@Injectable({
    providedIn: 'root'
})
export class IconService {
    private http = inject(HttpClient);
    private metadataUrl = 'https://fonts.google.com/metadata/icons';

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

    getSvgUrl(icon: string, family: string = 'Material Icons', version: number = 1): string {
        const familyMap: { [key: string]: string } = {
            'Material Icons': 'materialicons',
            'Material Icons Outlined': 'materialiconsoutlined',
            'Material Icons Round': 'materialiconsround',
            'Material Icons Sharp': 'materialiconssharp',
            'Material Icons Two Tone': 'materialiconstwotone'
        };
        const familyFolder = familyMap[family] || 'materialicons';
        return `https://fonts.gstatic.com/s/i/materialicons/${icon}/v${version}/24px.svg`.replace('materialicons', familyFolder);
    }
}
