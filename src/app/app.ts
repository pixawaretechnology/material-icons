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
  selectedSet = new BehaviorSubject<'icons' | 'symbols'>('symbols');
  selectedFamily = new BehaviorSubject<string>('Material Symbols Outlined');
  selectedCategory = new BehaviorSubject<string>('All');
  selectedIcon = new BehaviorSubject<IconMetadata | null>(null);

  // Customization state
  weight = new BehaviorSubject<number>(400);
  fill = new BehaviorSubject<number>(0);
  grade = new BehaviorSubject<number>(0);
  gradeStep = new BehaviorSubject<number>(1); // 0=-25, 1=0, 2=200
  gradeLabel = new BehaviorSubject<string>('0');
  opsz = new BehaviorSubject<number>(24);

  families$ = this.selectedSet.pipe(
    switchMap(set => this.iconService.getFamilies().pipe(
      map(families => {
        if (set === 'symbols') {
          return families.filter(f => f.startsWith('Material Symbols'));
        }
        return families.filter(f => f.startsWith('Material Icons'));
      })
    ))
  );

  categories$ = this.iconService.getCategories().pipe(
    map(cats => ['All', ...cats])
  );

  filteredIcons$!: Observable<IconMetadata[]>;
  iconRows$!: Observable<IconMetadata[][]>;
  isLoading = new BehaviorSubject<boolean>(true);
  columnsCount = new BehaviorSubject<number>(8);

  ngOnInit() {
    if (typeof window !== 'undefined') {
      this.updateColumnsCount();
      window.addEventListener('resize', () => this.updateColumnsCount());
    }

    this.filteredIcons$ = combineLatest([
      this.iconService.getIcons(),
      this.searchControl.valueChanges.pipe(
        startWith(''),
        debounceTime(300),
        distinctUntilChanged()
      ),
      this.selectedSet,
      this.selectedFamily,
      this.selectedCategory
    ]).pipe(
      map(([icons, search, set, family, category]) => {
        this.isLoading.next(false);

        // 1. Filter by family
        let filtered = icons.filter(icon => !icon.unsupported_families.includes(family));

        // 2. Filter by category
        if (category !== 'All') {
          filtered = filtered.filter(icon => icon.categories.includes(category));
        }

        // 3. Filter and Sort by search
        if (search) {
          const term = search.toLowerCase();
          filtered = filtered
            .filter(icon =>
              icon.name.toLowerCase().includes(term) ||
              icon.tags.some(tag => tag.toLowerCase().includes(term))
            )
            .sort((a, b) => {
              const aName = a.name.toLowerCase();
              const bName = b.name.toLowerCase();

              // Exact match first
              if (aName === term && bName !== term) return -1;
              if (bName === term && aName !== term) return 1;

              // Starts with next
              const aStarts = aName.startsWith(term);
              const bStarts = bName.startsWith(term);
              if (aStarts && !bStarts) return -1;
              if (bStarts && !aStarts) return 1;

              // Shorter name next
              return aName.length - bName.length;
            });
        } else {
          // Default sort by popularity
          filtered = filtered.sort((a, b) => b.popularity - a.popularity);
        }

        return filtered;
      })
    );

    // Group into rows for virtual scroll (dynamic icons per row)
    this.iconRows$ = combineLatest([this.filteredIcons$, this.columnsCount]).pipe(
      map(([icons, cols]) => {
        const rows: IconMetadata[][] = [];
        for (let i = 0; i < icons.length; i += cols) {
          rows.push(icons.slice(i, i + cols));
        }
        return rows;
      })
    );
  }

  updateColumnsCount() {
    if (typeof window === 'undefined') return;
    const width = window.innerWidth;
    if (width > 1200) this.columnsCount.next(8);
    else if (width > 900) this.columnsCount.next(6);
    else if (width > 600) this.columnsCount.next(4);
    else this.columnsCount.next(2);
  }

  highlightSearch(name: string): string {
    const term = this.searchControl.value;
    if (!term) return name;
    const regex = new RegExp(`(${term})`, 'gi');
    return name.replace(regex, '<span class="highlight">$1</span>');
  }

  selectIcon(icon: IconMetadata) {
    this.selectedIcon.next(icon);
  }

  selectFamily(family: string) {
    this.selectedFamily.next(family);
  }

  selectSet(set: 'icons' | 'symbols') {
    this.selectedSet.next(set);
    // Reset family to a default for the set
    if (set === 'symbols') {
      this.selectedFamily.next('Material Symbols Outlined');
    } else {
      this.selectedFamily.next('Material Icons');
    }
  }

  selectCategory(cat: string) {
    this.selectedCategory.next(cat);
  }

  updateWeight(val: string) { this.weight.next(parseInt(val, 10)); }
  updateGrade(step: string) {
    const s = parseInt(step, 10);
    this.gradeStep.next(s);
    const mapping: { [key: number]: number } = { 0: -25, 1: 0, 2: 200 };
    const val = mapping[s] ?? 0;
    this.grade.next(val);
    this.gradeLabel.next(val.toString());
  }
  updateOpsz(val: string) { this.opsz.next(parseInt(val, 10)); }
  toggleFill(e: Event) { this.fill.next((e.target as HTMLInputElement).checked ? 1 : 0); }

  getStyle() {
    return {
      '--symbol-weight': this.weight.value,
      '--symbol-fill': this.fill.value,
      '--symbol-grade': this.grade.value,
      '--symbol-opsz': this.opsz.value
    };
  }

  getIconClass() {
    const family = this.selectedFamily.value;
    if (family === 'Material Symbols Outlined') return 'material-symbols-outlined';
    if (family === 'Material Symbols Rounded') return 'material-symbols-rounded';
    if (family === 'Material Symbols Sharp') return 'material-symbols-sharp';
    return 'material-icons';
  }

  async downloadSvg() {
    const icon = this.selectedIcon.value;
    const family = this.selectedFamily.value;
    if (!icon) return;

    const axes = {
      wght: this.weight.value,
      fill: this.fill.value,
      grad: this.grade.value,
      opsz: this.opsz.value
    };

    const url = this.iconService.getSvgUrl(icon.name, family, axes, icon.version);

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
