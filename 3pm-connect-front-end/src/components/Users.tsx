import React, { Component } from "react";
import "../style/style.css";

class Users extends Component {
    constructor(props: any) {
        super(props);
        
    }
    state = {
        users: []
    };
    render() {
        return (
            <table>
                <thead>
                    <th></th>
                </thead>
            </table>
        );
    }
}
export default Users;