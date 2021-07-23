import React, { Component } from "react";
import "../style/style.css";

class MasterContainer extends Component {
    state = {

    }
    render() {
        return (<div id = "main">
            <div id = "splash3pm"></div>
            <div id = "inputPanel" style = {{ marginLeft: "auto", marginRight:"auto", marginTop:"50px" }}>
                <label htmlFor="username">Username</label>
                <tr></tr><input name="username"></input><br></br><br></br>
                <label htmlFor="password">Password</label>
                <tr></tr><input name="password"></input>
            </div>
        </div>);
    }
}
export default MasterContainer;