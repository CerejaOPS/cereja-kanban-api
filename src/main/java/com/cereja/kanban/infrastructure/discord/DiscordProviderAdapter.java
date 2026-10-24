package com.cereja.kanban.infrastructure.discord;

import com.cereja.kanban.application.exception.AuthenticationFailedException;
import com.cereja.kanban.application.auth.DiscordUserInfo;
import com.cereja.kanban.application.auth.IDiscordProviderPort;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Adaptador de saída (Driven Adapter) que implementa a porta de comunicação com o Discord.
 * Isola a camada de aplicação dos detalhes de infraestrutura, encapsulando o cliente HTTP
 * e o mapeamento dos contratos JSON específicos da API externa.
 */
@Component
public class DiscordProviderAdapter implements IDiscordProviderPort {

    private final RestClient restClient;
    private final String clientId;
    private final String clientSecret;
    private final String redirectUri;

    public DiscordProviderAdapter(@Value("${discord.client-id}") String clientId,
                                  @Value("${discord.client-secret}") String clientSecret,
                                  @Value("${discord.redirect-uri}") String redirectUri) {
        this.clientId = clientId;
        this.restClient = RestClient.builder().baseUrl("https://discord.com/api").build();
        this.clientSecret = clientSecret;
        this.redirectUri = redirectUri;
    }

    /** Resposta do endpoint /oauth2/token (formato do Discord, uso interno). */
    @JsonIgnoreProperties(ignoreUnknown = true)
    private record DiscordTokenResponse(@JsonProperty("access_token") String accessToken) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record DiscordUserResponse(String id, String username, String avatar){}

    /**
     * Troca o código de autorização pelo access_token do Discord.
     *
     * @param code código recebido no callback do OAuth2
     * @return access_token do usuário
     */
    @Override
    public String getAccessToken(String code) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_id", this.clientId);
        form.add("client_secret", this.clientSecret);
        form.add("grant_type", "authorization_code");
        form.add("code", code);
        form.add("redirect_uri", this.redirectUri);

        try {
            DiscordTokenResponse response = restClient.post()
                    .uri("/v10/oauth2/token")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(DiscordTokenResponse.class);

            if(response == null || response.accessToken() == null || response.accessToken().isBlank()){
                throw new AuthenticationFailedException("Token de acesso inválido ou não recebido pela API do Discord.");
            }

            return response.accessToken();

        } catch (RestClientException e) {
            throw new AuthenticationFailedException("Falha ao autenticar com o Discord.", e);
        }
    }

    /**
     * Consulta o perfil do usuário no endpoint /users/@me e extrai os atributos mínimos necessários para a aplicação.
     *
     * @param accessToken credencial de acesso obtida previamente na etapa de autorização
     * @return dados de perfil validados (id e username garantidos, avatar pode ser nulo)
     * @throws AuthenticationFailedException quando houver falha de comunicação, resposta vazia ou dados incompletos
     */
    @Override
    public DiscordUserInfo getUserInfo(String accessToken) {
        try {
            DiscordUserResponse response = restClient.get()
                    .uri("/v10/users/@me")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .retrieve()
                    .body(DiscordUserResponse.class);

            if (response == null) {
                throw new AuthenticationFailedException("A API do Discord retornou uma resposta vazia.");
            } else if (response.id() == null || response.id().isBlank() ||
                    response.username() == null || response.username().isBlank()) {
                throw new AuthenticationFailedException("Dados incompletos retornados pelo Discord: id ou username estão ausentes.");
            }

            return new DiscordUserInfo(response.id(), response.username(), response.avatar());

        } catch (RestClientException e) {
            throw new AuthenticationFailedException("Falha de comunicação ao buscar dados do usuário.", e);
        }
    }

    /**
     * Constrói a URL de autorização do Discord para iniciar o fluxo OAuth2.
     * Não realiza nenhuma requisição HTTP, apenas formata a string com os parâmetros corretos.
     *
     * @return URL completa para redirecionar o usuário para a tela de permissões do Discord.
     */
    @Override
    public String getAuthorizationUrl() {
        return UriComponentsBuilder.fromUriString("https://discord.com/oauth2/authorize")
                .queryParam("client_id", this.clientId)
                .queryParam("response_type", "code")
                .queryParam("redirect_uri", this.redirectUri)
                .queryParam("scope", "identify")
                .encode() // Obrigatório para codificar caracteres especiais no redirect_uri (como : e /)
                .toUriString();
    }
}