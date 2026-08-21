package com.cereja.kanban.domain.DiscordUser;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class DiscordUser {
    private Long id;
    private String discordId;
    private String username;
    private String avatar;
    private String role; //(ex: "dev", "pm")
}
