import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet,FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
 title = 'my-app';

 fortest(){
  return "hello"
 }
 user={
  name:'santhosh',
  age:30
 }
 newuser:any = null;
 newdata(){
  this.newuser={
    names:"raj"
  }
 }
}
