import React, { Component } from "react";
import "../style/style.css";

class MasterContainer extends Component {
    state = {
        username: "",
        password: ""
    }
    render() {
        return (<div id = "main">
            <div id = "splash3pm"><img src = "http://localhost:3000/3pmLogo2.png" style = {{ marginTop: "50px" }}></img></div>
            <div id = "inputPanel" style = {{ marginLeft: "auto", marginRight:"auto", marginTop:"50px" }}>
                <label htmlFor="username">Username</label>
                <tr></tr><input name="username"></input><br></br><br></br>
                <label htmlFor="password">Password</label>
                <tr></tr><input name="password" type = "password"></input><br></br>
                <img src="http://localhost:3000/myob-logo.jpg" width="150"></img>
                <img src="http://localhost:3000/zoho-creator.jpg" width="150"></img>
            </div>
        </div>);
    }
}
export default MasterContainer;