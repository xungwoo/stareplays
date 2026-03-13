package replaybucket

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

const (
	envBucketName   = "REPLAY_BUCKET_NAME"
	envBucketEP     = "REPLAY_BUCKET_ENDPOINT"
	envBucketRegion = "REPLAY_BUCKET_REGION"
	envBucketAK     = "REPLAY_BUCKET_ACCESS_KEY_ID"
	envBucketSK     = "REPLAY_BUCKET_SECRET_ACCESS_KEY"
	envPathStyle    = "REPLAY_BUCKET_PATH_STYLE"
)

type Client struct {
	bucket string
	s3     *s3.Client
}

func NewFromEnv(ctx context.Context) (*Client, error) {
	bucket := strings.TrimSpace(os.Getenv(envBucketName))
	endpoint := strings.TrimSpace(os.Getenv(envBucketEP))
	region := strings.TrimSpace(os.Getenv(envBucketRegion))
	ak := strings.TrimSpace(os.Getenv(envBucketAK))
	sk := strings.TrimSpace(os.Getenv(envBucketSK))

	if bucket == "" || endpoint == "" || ak == "" || sk == "" {
		return nil, fmt.Errorf("missing bucket env vars: %s/%s/%s/%s", envBucketName, envBucketEP, envBucketAK, envBucketSK)
	}
	if region == "" {
		region = "us-east-1"
	}

	baseURL, err := normalizeEndpoint(endpoint)
	if err != nil {
		return nil, err
	}
	pathStyle := envBoolDefaultTrue(envPathStyle)

	cfg, err := awsconfig.LoadDefaultConfig(
		ctx,
		awsconfig.WithRegion(region),
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(ak, sk, "")),
		awsconfig.WithEndpointResolverWithOptions(aws.EndpointResolverWithOptionsFunc(
			func(service, region string, options ...interface{}) (aws.Endpoint, error) {
				return aws.Endpoint{
					URL:               baseURL,
					SigningRegion:     region,
					HostnameImmutable: true,
				}, nil
			},
		)),
	)
	if err != nil {
		return nil, fmt.Errorf("load aws config: %w", err)
	}

	return &Client{
		bucket: bucket,
		s3: s3.NewFromConfig(cfg, func(o *s3.Options) {
			o.UsePathStyle = pathStyle
		}),
	}, nil
}

func normalizeEndpoint(endpoint string) (string, error) {
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		return "", errors.New("empty bucket endpoint")
	}
	if !strings.Contains(endpoint, "://") {
		endpoint = "https://" + endpoint
	}
	u, err := url.Parse(endpoint)
	if err != nil {
		return "", fmt.Errorf("parse bucket endpoint: %w", err)
	}
	u.Path = ""
	u.RawQuery = ""
	u.Fragment = ""
	return u.String(), nil
}

func envBoolDefaultTrue(key string) bool {
	raw := strings.TrimSpace(strings.ToLower(os.Getenv(key)))
	if raw == "" {
		return true
	}
	v, err := strconv.ParseBool(raw)
	if err != nil {
		return true
	}
	return v
}

func ReplayObjectKey(fileHash string) string {
	fileHash = strings.TrimSpace(strings.ToLower(fileHash))
	return "replays/" + fileHash + ".rep"
}

func (c *Client) PutReplay(ctx context.Context, fileHash string, data []byte) (string, error) {
	if c == nil || c.s3 == nil {
		return "", errors.New("nil replay bucket client")
	}
	if len(data) == 0 {
		return "", errors.New("empty replay payload")
	}
	key := ReplayObjectKey(fileHash)
	_, err := c.s3.PutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(c.bucket),
		Key:           aws.String(key),
		Body:          bytes.NewReader(data),
		ContentType:   aws.String("application/octet-stream"),
		ContentLength: aws.Int64(int64(len(data))),
	})
	if err != nil {
		return "", fmt.Errorf("put replay object: %w", err)
	}
	return key, nil
}

func (c *Client) DownloadToTempFile(ctx context.Context, key, tmpDir string) (string, error) {
	if c == nil || c.s3 == nil {
		return "", errors.New("nil replay bucket client")
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return "", errors.New("empty replay bucket key")
	}
	if strings.TrimSpace(tmpDir) == "" {
		tmpDir = os.TempDir()
	}
	if err := os.MkdirAll(tmpDir, 0o755); err != nil {
		return "", fmt.Errorf("prepare tmp dir: %w", err)
	}

	resp, err := c.s3.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return "", fmt.Errorf("get replay object: %w", err)
	}
	defer resp.Body.Close()

	f, err := os.CreateTemp(tmpDir, "replay-*.rep")
	if err != nil {
		return "", fmt.Errorf("create temp replay file: %w", err)
	}
	path := f.Name()
	defer func() {
		_ = f.Close()
	}()

	if _, err := io.Copy(f, resp.Body); err != nil {
		_ = os.Remove(path)
		return "", fmt.Errorf("write temp replay file: %w", err)
	}
	if err := f.Close(); err != nil {
		_ = os.Remove(path)
		return "", fmt.Errorf("close temp replay file: %w", err)
	}
	return filepath.Clean(path), nil
}
