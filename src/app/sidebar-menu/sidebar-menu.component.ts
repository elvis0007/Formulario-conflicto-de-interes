import { Component, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

type SidebarSection = 'form' | 'list';

@Component({
  selector: 'app-sidebar-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar-menu.component.html',
  styleUrl: './sidebar-menu.component.scss'
})
export class SidebarMenuComponent implements OnInit {
  @Input() activeSection: SidebarSection = 'form';
  @Input() canViewList: boolean = false;


  collapsed = true;
  private isMobileViewport = false;

  @Output() formClicked = new EventEmitter<void>();
  @Output() excuseClicked = new EventEmitter<void>();
  @Output() listClicked = new EventEmitter<void>();

  ngOnInit(): void {
    this.updateViewportState();
  }

  onFormClick(): void {
    this.formClicked.emit();
  }

  onExcuseClick(): void {
    this.excuseClicked.emit();
  }

  onListClick(): void {
    if (this.canViewList) {
      this.listClicked.emit();
    }
  }

  // Deslizar el menú al pasar el mouse sin afectar el resto del layout.
  onMouseEnter(): void {
    if (this.isMobileViewport) {
      return;
    }
    this.collapsed = false;
  }

  onMouseLeave(): void {
    if (this.isMobileViewport) {
      return;
    }
    this.collapsed = true;
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateViewportState();
  }

  private updateViewportState(): void {
    this.isMobileViewport = typeof window !== 'undefined' && window.innerWidth <= 768;
    this.collapsed = !this.isMobileViewport;
  }
}

