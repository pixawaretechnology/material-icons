import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormControl, ReactiveFormsModule } from '@angular/forms';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { IconService, IconMetadata } from './icon.service';
import { debounceTime, distinctUntilChanged, map, startWith, switchMap } from 'rxjs/operators';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ScrollingModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  private iconService = inject(IconService);

  searchControl = new FormControl('', { nonNullable: true });
  selectedFamily = new BehaviorSubject<string>('Material Icons');
  selectedIcon = new BehaviorSubject<IconMetadata | null>(null);

  families$ = this.iconService.getFamilies();
  filteredIcons$!: Observable<IconMetadata[]>;
  isLoading = new BehaviorSubject<boolean>(true);

  ngOnInit() {
    this.filteredIcons$ = combineLatest([
      this.iconService.getIcons(),
      this.searchControl.valueChanges.pipe(
        startWith(''),
        debounceTime(300),
        distinctUntilChanged()
      )
    ]).pipe(
      map(([icons, search]) => {
        this.isLoading.next(false);
        if (!search) return icons;
        const term = search.toLowerCase();
        return icons.filter(icon =>
          icon.name.toLowerCase().includes(term) ||
          icon.tags.some(tag => tag.toLowerCase().includes(term))
        );
      })
    );
  }

  selectIcon(icon: IconMetadata) {
    this.selectedIcon.next(icon);
  }

  selectFamily(family: string) {
    this.selectedFamily.next(family);
  }

  async downloadSvg() {
    const icon = this.selectedIcon.value;
    const family = this.selectedFamily.value;
    if (!icon) return;

    const url = this.iconService.getSvgUrl(icon.name, family, icon.version);

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Network response was not ok');
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${icon.name}_${family.replace(/\s+/g, '_').toLowerCase()}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Download failed', error);
      window.open(url, '_blank');
    }
  }
}
